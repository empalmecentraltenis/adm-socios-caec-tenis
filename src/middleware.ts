import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Proteger todas las rutas excepto login, api/auth, asistencia (pública), profe (pública), secretaria (pública), porteria (pública), socio-cuenta (pública), comision (pública) y archivos estáticos
  matcher: [
    "/((?!api/auth|api/secretaria|api/porteria|api/comision|api/asistencias|api/clases-profe|api/profe|api/socio-cuenta|asistencia|profe|profesor|secretaria|porteria|comision|login|_next/static|_next/image|favicon.ico|logo-caec.png).*)"
  ],
};
