import React, { useState, useContext } from "react";
import { login, register } from "../../api";
import { Form, Input, Button } from "<div className="" />styles";
import { AuthContext } from "../context/authContext";

export const AuthForm: React.FC = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthForm must be used within AuthProvider");

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        const { token } = await login(username, password);
        context.dispatch({ type: "LOGIN", payload: token });
      } else {
        await register(username, password);
        alert("Registration successful! Please log in.");
        setIsLogin(true);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <h3>{isLogin ? "Sign In" : "Register"}</h3>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <Input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button type="submit">{isLogin ? "Login" : "Create Account"}</Button>

      <p
        style={{ textAlign: "center", cursor: "pointer", color: "#ff6347" }}
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin
          ? "Need an account? Register"
          : "Already have an account? Log in"}
      </p>
    </Form>
  );
};
