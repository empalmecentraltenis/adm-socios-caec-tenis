import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Proteger todas las rutas excepto login, api/auth y archivos estáticos
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|logo-caec.png).*)",
  ],
};
