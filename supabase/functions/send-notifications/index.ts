import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone y message son requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(JSON.stringify({
        ok: false,
        pending: true,
        detail: "Configura TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE_NUMBER en Supabase Edge Functions."
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const normalizedPhone = phone.startsWith("+") ? phone : `+57${phone}`;
    const auth = btoa(`${accountSid}:${authToken}`);
    const body = new URLSearchParams({
      To: normalizedPhone,
      From: fromNumber,
      Body: message
    });

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      return new Response(JSON.stringify({ ok: false, error: twilioData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true, sid: twilioData.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
