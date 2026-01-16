import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Auth routes for sign in/sign out
auth.addHttpRoutes(http);

export default http;
