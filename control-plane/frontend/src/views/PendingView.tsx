export default function PendingView({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <div className="status-screen">
      <div className="status-card">
        <div className="status-icon pending">⏳</div>
        <h1>Conta em Análise de Acesso</h1>
        <p>
          Sua conta (<strong>{email}</strong>) foi criada e está aguardando aprovação de um
          administrador. Assim que for aprovada, você poderá iniciar seu workspace por aqui —
          não precisa fazer mais nada.
        </p>
        <button className="status-logout-btn" onClick={onLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}
