export default {
  async fetch(request, env) {
    try {
      const tokenResponse = await fetch("https://api.helloasso.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: env.HELLOASSO_CLIENT_ID,
          client_secret: env.HELLOASSO_CLIENT_SECRET
        })
      });
      if (!tokenResponse.ok) {
        return Response.json({ ok:false, step:"auth", status:tokenResponse.status }, { status:500 });
      }
      const tokenData = await tokenResponse.json();
      const url = new URL("https://api.helloasso.com/v5/organizations/mix-martial-academy/forms/Membership/adhesion-mma-2026-2027/items");
      url.searchParams.set("pageIndex","1");
      url.searchParams.set("pageSize","20");
      url.searchParams.set("withDetails","true");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept:"application/json" }
      });
      if (!response.ok) {
        return Response.json({ ok:false, step:"campaign", status:response.status }, { status:500 });
      }
      const data = await response.json();
      const items = Array.isArray(data.data) ? data.data : [];
      const fieldNames = [...new Set(items.flatMap(item => (item.customFields || []).map(field => field.name)))];
      return Response.json({
        ok:true,
        campaign:"adhesion-mma-2026-2027",
        itemsOnFirstPage:items.length,
        memberIdentityAvailable:items.filter(item => item.user?.firstName && item.user?.lastName).length,
        customFieldNames:fieldNames
      });
    } catch (error) {
      return Response.json({ ok:false, step:"worker", error:String(error?.message || error) }, { status:500 });
    }
  }
};
