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
  allowSkip = false,
  onSkipLogin,
}) {
  const roleLabel = role === 'admin' ? t.roleAdmin : role === 'analyst' ? t.roleAnalyst : t.roleEndUser;
  const title = role === 'end_user'
    ? (t.userLoginTitle ?? 'User Login')
    : t.analystAdminLoginTitle;
  const subtitle = role === 'end_user'
    ? (t.userLoginSubtitle ?? 'Sign in to personalize your experience, or continue as guest.')
    : t.analystAdminLoginSubtitle;

  return (
    <section className={styles.card}>
      <h2>{title}</h2>
      <p>
        {subtitle} <strong>{roleLabel}</strong>
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

      {allowSkip && !authUser ? (
        <button type="button" className={styles.skipBtn} onClick={onSkipLogin}>
          {t.skipLogin ?? 'Skip Login'}
        </button>
      ) : null}
    </section>
  );
}
