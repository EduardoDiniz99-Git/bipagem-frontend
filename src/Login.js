import React, { useState } from "react";
import { auth, db } from "./firebase"; // Uncomment db import
import "./Login.css";

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Emissão");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Add roles array
  const roles = [
    "Emissão",
    "DTF",
    "Estoque",
    "Paineis",
    "Checkout"
  ];

  const handleLogin = async () => {
    setError("");
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError("Email ou senha incorretos.");
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!name.trim()) return setError("Por favor, informe seu nome.");
    if (!email.trim()) return setError("Por favor, informe seu e‑mail.");
    if (!role) return setError("Por favor, selecione uma função.");
    if (password.length < 6) return setError("A senha deve ter no mínimo 6 caracteres.");

    try {
      // Create user authentication
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      
      // Update user profile
      await userCredential.user.updateProfile({ displayName: name });

      // Save user data to Firestore
      await db.collection("users").doc(userCredential.user.uid).set({
        name: name.trim(),
        role: role,
        email: email.trim(),
        createdAt: new Date(),
        active: true, // Add active status
        lastLogin: new Date(),
        uid: userCredential.user.uid
      });

    } catch (err) {
      console.error("Erro no registro:", err);
      setError(
        err.code === "auth/email-already-in-use"
          ? "Este e-mail já está em uso."
          : "Erro ao registrar. Verifique os dados e tente novamente."
      );
    }
  };

  return (
    <>
      <div className="login-background"></div>
      <div className="login-overlay"></div>

      <div className="login-container">
        <h2>{isRegistering ? "Criar Conta" : "Entrar no Sistema"}</h2>

        {error && <p className="error" aria-live="assertive">{error}</p>}

        {isRegistering && (
          <>
            <input
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              className="role-select"
            >
              <option value="">Selecione uma função</option>
              {roles.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleOption}
                </option>
              ))}
            </select>
          </>
        )}

        <input
          type="email"
          placeholder="E‑mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Senha (mín. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button onClick={isRegistering ? handleRegister : handleLogin}>
          {isRegistering ? "Registrar" : "Entrar"}
        </button>

        <p
          className="toggle-link"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError("");
          }}
        >
          {isRegistering
            ? "Já possui conta? Faça login"
            : "Não possui conta? Registre-se"}
        </p>
      </div>
    </>
  );
};

export default Login;
