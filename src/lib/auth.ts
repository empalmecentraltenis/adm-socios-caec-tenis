import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        // Visualizador
        if (credentials.username === "TenisCAEC" && credentials.password === "1234") {
          return { id: "1", name: "Visualizador", username: "TenisCAEC", role: "viewer" };
        }

        // Administrador Total
        if (credentials.username === "TenisCAECadmin" && credentials.password === "Tenis.2026") {
          return { id: "0", name: "Administrador", username: "TenisCAECadmin", role: "admin" };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "desarrollo-local-caec-tenis",
};
