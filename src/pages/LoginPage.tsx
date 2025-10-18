import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLoginMutation } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/stores/toast';

interface LoginFormValues {
  username: string;
  password: string;
  remember: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { push } = useToast();

  const form = useForm<LoginFormValues>({
    defaultValues: { username: 'demo', password: 'demo123', remember: false },
  });

  const loginMutation = useLoginMutation();

  useEffect(() => {
    if (accessToken) {
      navigate('/drive', { replace: true });
    }
  }, [accessToken, navigate]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const data = await loginMutation.mutateAsync({ username: values.username, password: values.password });
      setAuth({
        token: data.access_token,
        user: { username: data.user?.username ?? values.username, role: (data.user?.role as 'admin' | 'user') ?? 'user' },
        remember: values.remember,
      });
      push({ tone: 'success', title: 'ACCESS GRANTED', description: '身份验证成功，正在进入控制台。' });
      const redirect = (location.state as { from?: string } | null)?.from ?? '/drive';
      navigate(redirect, { replace: true });
    } catch (error) {
      push({ tone: 'danger', title: 'AUTH FAILED', description: (error as Error).message ?? '认证失败' });
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--bg-2)] p-8 shadow-elevated">
        <p className="font-mono text-sm tracking-[0.4em] text-[var(--fg-2)]">FD-CLIENT</p>
        <h1 className="mt-2 text-lg font-semibold">联邦盘 · 安全接入</h1>
        <p className="text-sm text-[var(--fg-2)]">请输入凭证，完成一次性密钥握手。</p>

        <form className="mt-6 space-y-6" onSubmit={onSubmit}>
          <div>
            <label className="font-mono text-xs uppercase text-[var(--fg-2)]">USERNAME</label>
            <Input type="text" autoComplete="username" {...form.register('username', { required: true })} />
          </div>
          <div>
            <label className="font-mono text-xs uppercase text-[var(--fg-2)]">PASSWORD</label>
            <Input type="password" autoComplete="current-password" {...form.register('password', { required: true })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
            <input type="checkbox" className="accent-[var(--accent)]" {...form.register('remember')} /> 记住我（存储在 LocalStorage）
          </label>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? '校验中…' : '进入控制台'}
          </Button>
        </form>
        <p className="mt-8 text-center text-xs text-[var(--fg-2)]">
          Mock 登录：demo / 任意密码 · 失败示例：添加 ?__variant=bad
        </p>
      </div>
    </div>
  );
}
