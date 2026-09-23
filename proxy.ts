import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 1. Define routes that do NOT require authentication
const isPublicRoute = createRouteMatcher([
  '/',                // Landing/Home page
  '/watch/(.*)',      // Shared video player pages
  '/api/pricing',     // Regional pricing API
  '/api/download',    // Video download proxy
  '/api/generate',    // Video generation proxy
  '/videovault(.*)', // Video vault pages
])

export default clerkMiddleware(async (auth, req) => {
  // 2. Protect routes that are not in the public list
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes (like your generation or claim endpoints)
    '/(api|trpc)(.*)',
  ],
}