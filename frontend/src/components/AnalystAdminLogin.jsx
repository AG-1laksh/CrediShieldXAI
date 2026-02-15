import { GoogleLogin } from '@react-oauth/google';
import styles from './AnalystAdminLogin.module.css';

export default function AnalystAdminLogin({
  role,
  t,
  googleClientIdConfigured,
  onGoogleSuccess,
  onGoogleError,
  authUser,
  onLogout,
}) {
  return (
    <section className={styles.card}>
      <h2>{t.analystAdminLoginTitle}</h2>
      <p>
        {t.analystAdminLoginSubtitle} <strong>{role === 'admin' ? t.roleAdmin : t.roleAnalyst}</strong>
      </p>

      {authUser ? (
        <div className={styles.signedInBox}>
          {authUser.picture ? <img src={authUser.picture} alt={authUser.name} className={styles.avatar} /> : null}
          <div>
            <p><strong>{t.loginSignedInAs}:</strong> {authUser.name}</p>
            <p>{authUser.email}</p>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>
            {t.logout}
          </button>
        </div>
      ) : null}

      {!googleClientIdConfigured ? (
        <p className={styles.warning}>{t.googleClientIdMissing}</p>
      ) : (
        <div className={styles.googleWrap}>
          <span>{t.signInWithGoogle}</span>
          <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={onGoogleError}
            useOneTap
            shape="pill"
            text="signin_with"
          />
        </div>
      )}
    </section>
  );
}
