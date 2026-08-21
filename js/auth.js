// ============================================================================
// js/auth.js — Supabase 이메일/비밀번호 로그인 (index.html, search.html 공용)
// ============================================================================
// index.html과 search.html이 동일하게 이 파일 하나를 <script src="js/auth.js">로
// 불러 쓴다. 로그인/회원가입 모달, 헤더 우측 로그인 상태 표시, 그리고 다른
// 기능(예: 나중의 "담기" 버튼)이 "지금 로그인한 사람이 누구인지" 물어볼 수
// 있는 공용 API(window.MatbabAuth)를 이 파일 하나가 전부 책임진다.
//
// Supabase URL/publishable key는 Stripe·Firebase의 publishable key와 같은
// 성격이라 브라우저에 그대로 노출해도 안전하다(실제 방어선은 RLS) — 그래서
// 카카오/구글/Gemini 키처럼 api/*.js 서버리스 프록시나 .env.local 폴백이
// 필요 없다.
//
// ⚠️ Supabase 대시보드 > Authentication > Sign In / Providers > Email에서
// "Confirm email"이 꺼져 있어야 회원가입 즉시 로그인이 된다(이메일 인증
// 대기 없음). 이 설정은 브라우저 코드로는 바꿀 수 없다.
// ============================================================================

(function () {
  const SUPABASE_URL = 'https://jwjvbsuyhsfocmapdzxb.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YVcEgoqyKICs5FazcKGJxg_NesXjWz2';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('[MatbabAuth] supabase-js가 로드되지 않아 로그인 기능을 초기화할 수 없습니다.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // ============================================================
  // 에러 메시지 한국어 매핑
  // ============================================================
  function mapAuthError(error) {
    const code = error && error.code;
    const msg = (error && error.message) || '';

    if (code === 'invalid_credentials' || /Invalid login credentials/i.test(msg)) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (code === 'user_already_exists' || /already registered/i.test(msg)) {
      return '이미 가입된 이메일입니다.';
    }
    if (code === 'weak_password' || /Password should be at least/i.test(msg)) {
      return '비밀번호는 6자 이상이어야 합니다.';
    }
    if (code === 'validation_failed' || /Unable to validate email address/i.test(msg)) {
      return '올바른 이메일 형식이 아닙니다.';
    }
    if (code === 'email_not_confirmed' || /Email not confirmed/i.test(msg)) {
      return '이메일 인증이 필요합니다. 잠시 후 다시 시도해주세요.';
    }
    if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
      return '잠시 후 다시 시도해주세요.';
    }
    return '문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }

  function displayName(user) {
    const email = (user && user.email) || '';
    return email.split('@')[0] || '사용자';
  }

  // ============================================================
  // 모달 — search.html의 기존 리뷰 모달과 동일한 접근성 패턴
  // (열기/닫기 시 포커스 기억·복귀, 배경 스크롤 잠금,
  //  Escape/배경 클릭/닫기 버튼으로 닫기)
  // ============================================================
  let overlay, modal, form, emailInput, passwordInput, errorBox, errorText, signInBtn, signUpBtn;
  let modalLastFocused = null;
  let modalReady = false;

  function ensureModal() {
    if (modalReady) return;
    modalReady = true;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="mb-auth-overlay" class="hidden fixed inset-0 z-[60] bg-cocoa/50 backdrop-blur-[2px] flex items-center justify-center p-4" aria-hidden="true">
        <div id="mb-auth-modal" role="dialog" aria-modal="true" aria-labelledby="mb-auth-title" tabindex="-1" class="bg-white rounded-card shadow-hover w-full max-w-sm relative focus:outline-none p-6 md:p-8">
          <button type="button" id="mb-auth-close" aria-label="닫기" class="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-control text-bark hover:text-cocoa hover:bg-ivory transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey focus-visible:ring-offset-2">
            <i data-lucide="x" class="w-5 h-5" aria-hidden="true"></i>
          </button>
          <h2 id="mb-auth-title" class="font-title font-bold text-xl text-cocoa mb-1 pr-8">로그인</h2>
          <p class="text-sm text-bark mb-6">이메일과 비밀번호로 로그인하거나 새 계정을 만드세요.</p>
          <form id="mb-auth-form" class="flex flex-col gap-3" novalidate>
            <div>
              <label for="mb-auth-email" class="sr-only">이메일</label>
              <input id="mb-auth-email" name="email" type="email" autocomplete="email" required placeholder="이메일" class="w-full h-12 px-4 rounded-control border border-wheat/60 bg-cream text-cocoa placeholder:text-bark/70 focus:outline-none focus:ring-2 focus:ring-honey/40 transition-shadow duration-200" />
            </div>
            <div>
              <label for="mb-auth-password" class="sr-only">비밀번호</label>
              <input id="mb-auth-password" name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="비밀번호 (6자 이상)" class="w-full h-12 px-4 rounded-control border border-wheat/60 bg-cream text-cocoa placeholder:text-bark/70 focus:outline-none focus:ring-2 focus:ring-honey/40 transition-shadow duration-200" />
            </div>
            <p id="mb-auth-error" class="hidden items-start gap-1.5 text-sm text-cocoa bg-honey-soft/40 rounded-control px-3 py-2" role="alert" aria-live="polite">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-blueberry/70 flex-shrink-0 mt-0.5" aria-hidden="true"></i>
              <span id="mb-auth-error-text"></span>
            </p>
            <div class="flex gap-2 mt-1">
              <button type="submit" id="mb-auth-signin" class="flex-1 h-11 rounded-full bg-honey text-cocoa font-title font-medium text-sm hover:bg-amber-deep transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed">로그인</button>
              <button type="button" id="mb-auth-signup" class="flex-1 h-11 rounded-control border border-wheat/60 text-cocoa font-title font-medium text-sm hover:border-honey hover:bg-honey-soft/40 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed">회원가입</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);

    overlay = document.getElementById('mb-auth-overlay');
    modal = document.getElementById('mb-auth-modal');
    form = document.getElementById('mb-auth-form');
    emailInput = document.getElementById('mb-auth-email');
    passwordInput = document.getElementById('mb-auth-password');
    errorBox = document.getElementById('mb-auth-error');
    errorText = document.getElementById('mb-auth-error-text');
    signInBtn = document.getElementById('mb-auth-signin');
    signUpBtn = document.getElementById('mb-auth-signup');

    document.getElementById('mb-auth-close').addEventListener('click', closeAuthModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAuthModal(); // 배경 클릭(모달 내부 클릭은 버블링만 될 뿐 대상이 다름)
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      handleSignIn();
    });
    signUpBtn.addEventListener('click', () => {
      if (!form.reportValidity()) return;
      handleSignUp();
    });

    if (window.lucide) lucide.createIcons();
  }

  function hideError() {
    errorBox.classList.add('hidden');
    errorBox.classList.remove('flex');
  }

  function showError(message) {
    errorText.textContent = message;
    errorBox.classList.remove('hidden');
    errorBox.classList.add('flex');
  }

  function setBusy(busy) {
    signInBtn.disabled = busy;
    signUpBtn.disabled = busy;
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') closeAuthModal();
  }

  function openAuthModal() {
    ensureModal();
    hideError();
    form.reset();
    modalLastFocused = document.activeElement;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onModalKeydown);
    emailInput.focus();
  }

  function closeAuthModal() {
    if (!modalReady) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onModalKeydown);
    if (modalLastFocused && typeof modalLastFocused.focus === 'function') {
      modalLastFocused.focus();
    }
  }

  async function handleSignIn() {
    setBusy(true);
    hideError();
    try {
      const { error } = await client.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });
      if (error) throw error;
      closeAuthModal();
    } catch (err) {
      showError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp() {
    setBusy(true);
    hideError();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    try {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;

      if (data.session) {
        // 이메일 확인이 꺼져 있으면 가입과 동시에 세션이 바로 온다 — 여기서 끝.
        closeAuthModal();
        return;
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        // 이메일 확인이 켜져 있을 때, Supabase가 "이미 가입된 이메일"을
        // 알리는 방식(사용자 열거 방지를 위해 에러 대신 이렇게 응답한다).
        throw { code: 'user_already_exists', message: 'User already registered' };
      }

      // 세션 없이 새 유저만 생성된 경우(=이메일 확인이 아직 켜져 있는 경우) —
      // "회원가입하면 바로 로그인"을 최대한 만족시키기 위해 즉시 로그인을 시도한다.
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      closeAuthModal();
    } catch (err) {
      showError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // 헤더 우측 로그인 상태 표시 — data-mb-auth-slot이 붙은 모든 요소에 렌더링
  // ============================================================
  function renderAuthSlot(el, user) {
    el.innerHTML = '';
    if (user) {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-3 text-sm';

      const label = document.createElement('span');
      label.className = 'text-cocoa';
      const strong = document.createElement('strong');
      strong.className = 'font-medium';
      strong.textContent = displayName(user);
      label.appendChild(strong);
      label.appendChild(document.createTextNode('님'));

      const logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'font-medium text-blueberry hover:text-cocoa transition-colors duration-200 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey focus-visible:ring-offset-2 focus-visible:ring-offset-cream';
      logoutBtn.textContent = '로그아웃';
      logoutBtn.addEventListener('click', () => {
        logoutBtn.disabled = true;
        client.auth.signOut();
      });

      wrap.appendChild(label);
      wrap.appendChild(logoutBtn);
      el.appendChild(wrap);
    } else {
      const loginBtn = document.createElement('button');
      loginBtn.type = 'button';
      loginBtn.className = 'inline-flex items-center h-9 px-4 rounded-control border border-wheat/60 text-sm font-medium text-cocoa hover:border-honey hover:bg-honey-soft/40 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey focus-visible:ring-offset-2 focus-visible:ring-offset-cream';
      loginBtn.textContent = '로그인';
      loginBtn.addEventListener('click', openAuthModal);
      el.appendChild(loginBtn);
    }
  }

  function renderAllSlots(user) {
    document.querySelectorAll('[data-mb-auth-slot]').forEach((el) => renderAuthSlot(el, user));
  }

  // 최초 세션 복원(INITIAL_SESSION)·로그인(SIGNED_IN)·로그아웃(SIGNED_OUT) 전부
  // 이 콜백 하나로 처리된다 — 별도 초기 렌더 호출이 필요 없다.
  client.auth.onAuthStateChange((_event, session) => {
    renderAllSlots(session ? session.user : null);
  });

  // ============================================================
  // 공용 API — 다른 기능(예: 나중의 "담기" 버튼)이 로그인 여부를 확인하거나
  // 비로그인 사용자에게 이 로그인 모달을 재사용해 로그인을 유도할 때 쓴다.
  // ============================================================
  window.MatbabAuth = {
    client,
    getUser: async () => (await client.auth.getUser()).data.user,
    getSession: async () => (await client.auth.getSession()).data.session,
    onChange: (callback) => client.auth.onAuthStateChange((_event, session) => callback(session ? session.user : null)),
    signOut: () => client.auth.signOut(),
    openLoginModal: () => openAuthModal(),
  };
})();
