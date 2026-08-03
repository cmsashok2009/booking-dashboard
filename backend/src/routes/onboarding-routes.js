import { parseCsv } from "../validators.js";
import {
  activateUser,
  cancelOnboardingWorkflow,
  createOnboardingWorkflow,
  createSingleUserOnboarding,
  importOnboardingUsers,
  ownedOnboardingWorkflow,
  previewWorkflowEmail,
  publicCampaign,
  returnWorkflowToTemplate,
  selectWorkflowTemplate,
  sendInvitationCampaign,
  updateWorkflowRecipients,
  validateActivationToken,
  workflowRecipients,
} from "../onboarding.js";
import { queryOnboardingWorkflows } from "../onboarding-workflow-query.js";

export async function handleOnboardingRoutes(context) {
  const {
    req,
    res,
    url,
    pathname,
    db,
    sendJson,
    readBody,
    saveDb,
    authenticatedAdmin,
  } = context;

  if (req.method === "POST" && pathname === "/api/auth/activation/validate") {
    const body = await readBody(req);
    const result = validateActivationToken(db, body.token);
    return sendJson(
      res,
      result.valid ? 200 : 422,
      result.valid
        ? { valid: true, user: result.user, expiresAt: result.token.expiresAt }
        : result,
    );
  }

  if (req.method === "POST" && pathname === "/api/auth/activation/complete") {
    const body = await readBody(req);
    if (body.password !== body.confirmPassword) {
      return sendJson(res, 422, {
        valid: false,
        error: "Passwords do not match",
        errors: ["Enter the same password in both fields"],
      });
    }
    const result = activateUser(db, body.token, String(body.password || ""));
    if (result.valid) await saveDb(db);
    return sendJson(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "POST" && pathname === "/api/admin/onboarding/validate") {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    const parsed = parseCsv(body.content || "");
    if (parsed.rows.length > 500)
      return sendJson(res, 422, {
        error: "Upload at most 500 users per batch",
      });
    const workflow = createOnboardingWorkflow(db, parsed.rows, {
      fileName: body.fileName,
      actorId: admin.id,
    });
    await saveDb(db);
    return sendJson(res, 200, workflow);
  }

  if (req.method === "POST" && pathname === "/api/admin/onboarding/single") {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    const result = createSingleUserOnboarding(db, body, admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status || 422 : 201, result);
  }

  if (req.method === "GET" && pathname === "/api/admin/onboarding") {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    return sendJson(
      res,
      200,
      queryOnboardingWorkflows(
        db.onboardingWorkflows,
        admin.id,
        url.searchParams,
      ),
    );
  }

  const onboardingMatch = pathname.match(/^\/api\/admin\/onboarding\/([^/]+)$/);
  if (req.method === "GET" && onboardingMatch) {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    const workflow = ownedOnboardingWorkflow(
      db,
      decodeURIComponent(onboardingMatch[1]),
      admin.id,
    );
    if (workflow.error)
      return sendJson(res, workflow.status, { error: workflow.error });
    return sendJson(res, 200, {
      ...workflow,
      recipients: workflowRecipients(db, workflow),
      campaign: publicCampaign(
        db.emailCampaigns.find((item) => item.id === workflow.campaignId),
      ),
    });
  }

  const actionMatch = pathname.match(
    /^\/api\/admin\/onboarding\/([^/]+)\/(import|template|preview|recipients|back|send|cancel)$/,
  );
  if (!actionMatch) return null;
  const workflowId = decodeURIComponent(actionMatch[1]);
  const action = actionMatch[2];

  if (req.method === "GET" && action === "preview") {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    const workflow = ownedOnboardingWorkflow(db, workflowId, admin.id);
    if (workflow.error)
      return sendJson(res, workflow.status, { error: workflow.error });
    const result = previewWorkflowEmail(
      db,
      workflowId,
      url.searchParams.get("templateId"),
    );
    return sendJson(res, result.error ? result.status : 200, result);
  }

  if (req.method !== "POST") return null;
  const body = await readBody(req);
  const admin = authenticatedAdmin(req, db);
  if (!admin) return sendJson(res, 403, { error: "Admin access is required" });
  let result;
  if (action === "import")
    result = importOnboardingUsers(db, workflowId, admin.id);
  if (action === "template")
    result = selectWorkflowTemplate(db, workflowId, body.templateId, admin.id);
  if (action === "back")
    result = returnWorkflowToTemplate(db, workflowId, admin.id);
  if (action === "recipients") {
    result = updateWorkflowRecipients(
      db,
      workflowId,
      body.excludedRecipientIds,
      admin.id,
    );
  }
  if (action === "send") {
    result = await sendInvitationCampaign(
      db,
      workflowId,
      admin.id,
      process.env.APP_URL || body.appUrl || "http://localhost:3000",
    );
  }
  if (action === "cancel")
    result = cancelOnboardingWorkflow(db, workflowId, admin.id);
  if (!result)
    return sendJson(res, 405, { error: "Unsupported onboarding action" });
  if (result.error) {
    return sendJson(res, result.status || 422, {
      error: result.error,
      code: result.code || "ONBOARDING_ACTION_FAILED",
    });
  }
  await saveDb(db);
  return sendJson(
    res,
    200,
    action === "send" ? publicCampaign(result) : result,
  );
}
