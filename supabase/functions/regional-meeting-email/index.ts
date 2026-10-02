import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const esc = (v: unknown) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')
const fmtDate = (v: string) => { const [y,m,d] = v.split('-'); return `${d}/${m}/${y}` }
const fmtTime = (v: string) => v.slice(0,5)

function renderEmail(sender: string, meeting: any, clubs: string[]) {
  const date = fmtDate(meeting.meeting_date)
  const time = `${fmtTime(meeting.start_time)} – ${fmtTime(meeting.end_time)}`
  const location = meeting.is_online ? 'En ligne' : (meeting.place || 'Lieu non précisé')
  const clubText = clubs.length ? clubs.join(' · ') : 'Tous les clubs'
  const text = `Dans le cadre du suivi des activités et de la coordination des actions à venir, une réunion d’évaluation est programmée le ${date} à ${time}, ${location.toLowerCase()}.\n\nCette réunion rassemblera les doyens ainsi que les coordinateurs.\n\nInformations de la réunion :\nDate : ${date}\nHoraire : ${time}\nLieu : ${location}\nClubs concernés : ${clubText}\nDescription : ${meeting.description}\n\nVotre présence et votre ponctualité sont vivement souhaitées afin d'assurer le bon déroulement de la réunion.\n\nCordialement,\n\n${sender}\nRegional Coordinator`
  const html = `<div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden"><div style="padding:24px 28px;background:#0f172a;color:#fff"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#cbd5e1;font-weight:700">EventHub</div><h1 style="margin:8px 0 0;font-size:22px">Réunion de coordination</h1></div><div style="padding:28px"><p style="line-height:1.7">Dans le cadre du suivi des activités et de la coordination des actions à venir, une réunion d’évaluation est programmée <strong>le ${esc(date)} à ${esc(time)}</strong>, <strong>${esc(location.toLowerCase())}</strong>.</p><p style="line-height:1.7">Cette réunion rassemblera les <strong>doyens</strong> ainsi que les <strong>coordinateurs</strong>.</p><div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:20px 0;background:#f8fafc"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700">Informations de la réunion</div><p><strong>Date :</strong> ${esc(date)}</p><p><strong>Horaire :</strong> ${esc(time)}</p><p><strong>Lieu :</strong> ${esc(location)}</p><p><strong>Clubs concernés :</strong> ${esc(clubText)}</p><p><strong>Description :</strong> ${esc(meeting.description)}</p></div><p style="line-height:1.7">Votre présence et votre ponctualité sont vivement souhaitées afin d'assurer le bon déroulement de la réunion.</p><p style="line-height:1.6">Cordialement,<br><strong>${esc(sender)}</strong><br><span style="color:#dc2626;font-weight:700">Regional Coordinator</span></p></div></div></div>`
  return { text, html }
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null
function getTransport(user: string, pass: string) {
  if (!transport) transport = nodemailer.createTransport({ host:'smtp.gmail.com', port:465, secure:true, auth:{ user, pass } })
  return transport
}

async function getRecipients(admin: any, regionalEmail: string) {
  const [{ data: deans, error: deanError }, { data: coords, error: coordError }] = await Promise.all([
    admin.from('profiles').select('manager_name,email').eq('role','dean').not('email','is',null),
    admin.from('coordinators').select('username,email').not('email','is',null),
  ])
  if (deanError) throw deanError
  if (coordError) throw coordError
  return [
    ...(deans ?? []).map((r:any) => ({ name:r.manager_name || 'Dean', email:r.email, type:'Dean' as const })),
    ...(coords ?? []).filter((r:any) => r.email?.toLowerCase() !== regionalEmail.toLowerCase()).map((r:any) => ({ name:r.username || 'Coordinator', email:r.email, type:'Coordinator' as const })),
  ].filter((r:any,i:number,a:any[]) => a.findIndex((x:any) => x.email.toLowerCase() === r.email.toLowerCase()) === i)
}

async function main(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!service) return json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured.'},500)
    const auth = req.headers.get('Authorization') || ''
    if (!auth) return json({error:'Missing Authorization header.'},401)
    const caller = createClient(url, anon, { global:{headers:{Authorization:auth}} })
    const {data:{user}} = await caller.auth.getUser()
    if (!user?.email) return json({error:'Not authenticated.'},401)
    const admin = createClient(url, service)
    const {data:regional,error:regionalError} = await admin.from('coordinators').select('email,username,field').ilike('email',user.email).eq('field','regional').maybeSingle()
    if (regionalError) return json({error:regionalError.message},500)
    if (!regional) return json({error:'Only the regional coordinator can use this action.'},403)
    const recipients = await getRecipients(admin, regional.email)
    const body = await req.json()

    if (body.action === 'preview') {
      const meeting = body.meeting
      if (!meeting?.meeting_date || !meeting.start_time || !meeting.end_time || !meeting.description) return json({error:'Meeting information is incomplete.'},400)
      let clubs:string[] = []
      if (meeting.club_ids?.length) {
        const {data} = await admin.from('clubs').select('name').in('id',meeting.club_ids)
        clubs = (data ?? []).map((c:any)=>c.name)
      }
      const rendered = renderEmail(regional.username || 'Regional Coordinator', meeting, clubs)
      return json({ subject:'EventHub — Réunion de coordination', sender_name:regional.username || 'Regional Coordinator', sender_role:'Regional Coordinator', recipients, html:rendered.html, text:rendered.text })
    }

    if (body.action === 'send') {
      if (!body.meeting_id) return json({error:'meeting_id is required.'},400)
      const {data:meeting,error:meetingError} = await admin.from('meetings').select('*').eq('id',body.meeting_id).single()
      if (meetingError || !meeting) return json({error:meetingError?.message || 'Meeting not found.'},404)
      if (meeting.created_by_coordinator_email?.toLowerCase() !== regional.email.toLowerCase() || meeting.created_by_coordinator_field !== 'regional') return json({error:'This meeting was not created by the regional coordinator.'},403)
      if (!recipients.length) return json({error:'No recipients were found.'},400)
      let clubs:string[] = []
      if (meeting.club_ids?.length) { const {data}=await admin.from('clubs').select('name').in('id',meeting.club_ids); clubs=(data??[]).map((c:any)=>c.name) }
      const gmail = Deno.env.get('GMAIL_USER')
      const password = Deno.env.get('GMAIL_APP_PASSWORD')
      if (!gmail || !password) return json({error:'Gmail SMTP secrets are not configured.'},500)
      const rendered = renderEmail(regional.username || 'Regional Coordinator',meeting,clubs)
      const mailer = getTransport(gmail,password)
      const [first,...bcc] = recipients
      await mailer.sendMail({from:`${Deno.env.get('GMAIL_FROM_NAME') || 'EventHub'} <${gmail}>`,to:first.email,bcc:bcc.map((r:any)=>r.email),subject:'EventHub — Réunion de coordination',text:rendered.text,html:rendered.html})
      return json({sent:true,recipient_count:recipients.length})
    }
    return json({error:'Invalid action.'},400)
  } catch (e) {
    console.error('regional-meeting-email:',e)
    return json({error:e instanceof Error ? e.message : String(e)},500)
  }
}
Deno.serve(main)
