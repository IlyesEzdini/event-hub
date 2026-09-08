const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  console.log("🔥 notify-admin TEST FUNCTION STARTED");

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "notify-admin is alive",
      resendKeyConfigured: !!Deno.env.get("RESEND_API_KEY"),
      adminEmailConfigured: !!Deno.env.get("ADMIN_EMAIL"),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
});