import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "../auth";
import { registerAuthRoutes } from "./auth.routes";
import { registerBillingRoutes } from "./billing.routes";
import { registerVerificationRoutes } from "./verification.routes";
import { registerDevRoutes } from "./dev.routes";
import { registerSendbirdRoutes } from "./sendbird.routes";
import { registerProfileRoutes } from "./profile.routes";
import { registerMediaRoutes } from "./media.routes";
import { registerOnboardingRoutes } from "./onboarding.routes";
import { registerDiscoveryRoutes } from "./discovery.routes";
import { registerMatchRoutes } from "./matches.routes";
import { registerChaperoneRoutes } from "./chaperones.routes";
import { registerCallRoutes } from "./calls.routes";
import { registerPushRoutes } from "./push.routes";
import { registerSafetyRoutes } from "./safety.routes";
import { registerMiscRoutes } from "./misc.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  registerAuthRoutes(app);
  registerBillingRoutes(app);
  registerVerificationRoutes(app);
  registerDevRoutes(app);
  registerSendbirdRoutes(app);
  registerProfileRoutes(app);
  registerMediaRoutes(app);
  registerOnboardingRoutes(app);
  registerDiscoveryRoutes(app);
  registerMatchRoutes(app);
  registerChaperoneRoutes(app);
  registerCallRoutes(app);
  registerPushRoutes(app);
  registerSafetyRoutes(app);
  registerMiscRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
