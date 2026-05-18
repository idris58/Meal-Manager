import { useEffect, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Megaphone, Pencil, RefreshCcw, Save, Share2, Trash2 } from 'lucide-react';
import { addHours, format, formatDistanceToNow, isPast, parseISO } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { useMeal } from '@/lib/meal-context';
import { supabase } from '@/lib/supabase';

type ShareLinkConfig = {
  token: string;
  is_enabled: boolean;
};

function createShareToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

function CurrentCycleSettingsCard() {
  const { activeCycle, renameActiveCycle } = useMeal();
  const [cycleName, setCycleName] = useState(activeCycle?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCycleName(activeCycle?.name ?? '');
    setMessage(null);
    setError(null);
  }, [activeCycle?.id, activeCycle?.name]);

  const trimmedName = cycleName.trim();
  const isUnchanged = Boolean(activeCycle) && trimmedName === activeCycle?.name;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!activeCycle) {
      setError('No active cycle is available to rename.');
      return;
    }

    if (!trimmedName) {
      setError('Cycle name is required.');
      return;
    }

    if (isUnchanged) {
      return;
    }

    setSaving(true);
    try {
      await renameActiveCycle(trimmedName);
      setMessage('Current cycle name updated.');
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to rename the current cycle right now.';
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Current Cycle</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rename the active cycle so it is easier to identify in history and shared records later.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="cycle-name">
              Cycle name
            </label>
            <Input
              id="cycle-name"
              value={cycleName}
              onChange={(event) => {
                setCycleName(event.target.value);
                if (message) setMessage(null);
                if (error) setError(null);
              }}
              placeholder="Meal_Summer-26"
              disabled={!activeCycle || saving}
            />
          </div>

          <Button type="submit" className="gap-2" disabled={!activeCycle || saving || isUnchanged}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Cycle Name'}
          </Button>

          {message ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function ShareSettingsCard() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ShareLinkConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let active = true;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('share_links')
          .select('token, is_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (active) {
          setConfig(data ? { token: data.token, is_enabled: data.is_enabled } : null);
        }
      } catch (caughtError) {
        if (!active) {
          return;
        }

        console.error('Error loading share link config:', caughtError);
        setError('Unable to load share settings. Run the share_links SQL setup first if needed.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadConfig();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const shareUrl = config?.token ? `${window.location.origin}/shared/${config.token}` : '';
  const mealCode = config?.token ?? '';

  const upsertConfig = async (nextConfig: ShareLinkConfig) => {
    if (!user?.id) {
      return null;
    }

    setWorking(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: upsertError } = await supabase
        .from('share_links')
        .upsert(
          {
            user_id: user.id,
            token: nextConfig.token,
            is_enabled: nextConfig.is_enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .select('token, is_enabled')
        .single();

      if (upsertError) {
        throw upsertError;
      }

      setConfig({ token: data.token, is_enabled: data.is_enabled });
      return data;
    } catch (caughtError) {
      console.error('Error saving share config:', caughtError);
      setError('Unable to update the share link right now.');
      return null;
    } finally {
      setWorking(false);
    }
  };

  const handleEnableSharing = async () => {
    const nextToken = config?.token ?? createShareToken();
    const saved = await upsertConfig({ token: nextToken, is_enabled: true });

    if (saved) {
      setMessage('Sharing is enabled. You can now copy the public view link.');
    }
  };

  const handleDisableSharing = async () => {
    if (!config) {
      return;
    }

    const saved = await upsertConfig({ token: config.token, is_enabled: false });

    if (saved) {
      setMessage('Sharing is disabled. The old link will no longer work.');
    }
  };

  const handleRegenerate = async () => {
    const saved = await upsertConfig({
      token: createShareToken(),
      is_enabled: true,
    });

    if (saved) {
      setMessage('A new share link was generated. The previous link is now invalid.');
    }
  };

  const handleCopy = async () => {
    if (!shareUrl || !config?.is_enabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage('Shared link copied to clipboard.');
      setError(null);
    } catch (caughtError) {
      console.error('Error copying shared link:', caughtError);
      setError('Unable to copy the link. Copy it manually from the field below.');
    }
  };

  const handleCopyMealCode = async () => {
    if (!mealCode || !config?.is_enabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(mealCode);
      setMessage('Meal Code copied to clipboard.');
      setError(null);
    } catch (caughtError) {
      console.error('Error copying Meal Code:', caughtError);
      setError('Unable to copy the Meal Code right now. Copy it manually from the field below.');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-emerald-500" />
          Share Current Cycle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create a read-only public link so other members can view the current meal cycle without logging in.
        </p>

        <div className="rounded-xl border bg-secondary/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Sharing status</p>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? 'Loading share settings...'
                  : config?.is_enabled
                    ? 'Enabled'
                    : 'Disabled'}
              </p>
            </div>
            <Button
              variant={config?.is_enabled ? 'outline' : 'default'}
              onClick={config?.is_enabled ? handleDisableSharing : handleEnableSharing}
              disabled={loading || working}
            >
              {config?.is_enabled ? 'Disable Share' : 'Enable Share'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Public link</label>
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              placeholder="Enable sharing to generate a public link"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!config?.is_enabled || !shareUrl}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Meal Code</label>
          <div className="flex gap-2">
            <Input
              value={mealCode}
              readOnly
              placeholder="Enable sharing to generate a Meal Code"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyMealCode}
              disabled={!config?.is_enabled || !mealCode}
            >
              Copy Meal Code
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {config?.is_enabled && shareUrl ? (
            <Button type="button" variant="outline" className="gap-2" asChild>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open Shared View
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" className="gap-2" disabled>
              <ExternalLink className="h-4 w-4" />
              Open Shared View
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleRegenerate}
            disabled={loading || working}
          >
            <RefreshCcw className="h-4 w-4" />
            Regenerate Link
          </Button>
        </div>

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ActiveNotice = {
  id: string;
  title: string;
  content: string;
  expires_at: string;
};

function NoticeSettingsCard() {
  const { user } = useAuth();
  const [activeNotice, setActiveNotice] = useState<ActiveNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditingNotice, setIsEditingNotice] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expiryMode, setExpiryMode] = useState<'hours' | 'datetime'>('hours');
  const [durationHours, setDurationHours] = useState('24');
  const [expiryDatetime, setExpiryDatetime] = useState('');

  // Build the minimum value for datetime-local (now)
  const minDatetime = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const resetNoticeForm = () => {
    setTitle('');
    setContent('');
    setExpiryMode('hours');
    setDurationHours('24');
    setExpiryDatetime('');
    setIsEditingNotice(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString();
        const { error: cleanupError } = await supabase
          .from('notices')
          .delete()
          .eq('user_id', user.id)
          .lte('expires_at', now);

        if (cleanupError) throw cleanupError;

        const { data, error: fetchError } = await supabase
          .from('notices')
          .select('id, title, content, expires_at')
          .eq('user_id', user.id)
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (active) setActiveNotice(data as ActiveNotice | null);
      } catch (err) {
        console.error('Error loading notice:', err);
        if (active) setError('Could not load notices. Make sure the notices table exists in Supabase.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!activeNotice || !user?.id) return;

    const delay = parseISO(activeNotice.expires_at).getTime() - Date.now();
    if (delay <= 0) {
      setActiveNotice(null);
      resetNoticeForm();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void supabase
        .from('notices')
        .delete()
        .eq('id', activeNotice.id)
        .eq('user_id', user.id)
        .then(({ error: deleteError }) => {
          if (deleteError) {
            console.error('Error deleting expired notice:', deleteError);
            return;
          }

          setActiveNotice((currentNotice) =>
            currentNotice?.id === activeNotice.id ? null : currentNotice,
          );
          resetNoticeForm();
        });
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [activeNotice, user?.id]);

  const handleSubmitNotice = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.id) return;

    const trimTitle = title.trim();
    const trimContent = content.trim();

    if (!trimTitle) { setError('Title is required.'); return; }
    if (!trimContent) { setError('Content is required.'); return; }

    let expiresAt: Date;
    if (expiryMode === 'hours') {
      const hours = parseFloat(durationHours);
      if (isNaN(hours) || hours <= 0) { setError('Enter a valid duration in hours.'); return; }
      expiresAt = addHours(new Date(), hours);
    } else {
      if (!expiryDatetime) { setError('Select an expiry date and time.'); return; }
      expiresAt = parseISO(expiryDatetime);
      if (isPast(expiresAt)) { setError('Expiry must be in the future.'); return; }
    }

    setWorking(true);
    setError(null);
    setMessage(null);

    try {
      if (isEditingNotice && activeNotice) {
        const { data, error: updateError } = await supabase
          .from('notices')
          .update({
            title: trimTitle,
            content: trimContent,
            expires_at: expiresAt.toISOString(),
          })
          .eq('id', activeNotice.id)
          .eq('user_id', user.id)
          .select('id, title, content, expires_at')
          .single();

        if (updateError) throw updateError;

        setActiveNotice(data as ActiveNotice);
        resetNoticeForm();
        setMessage('Notice updated. The shared view will show the new text immediately.');
        return;
      }

      const now = new Date().toISOString();
      await supabase
        .from('notices')
        .update({ expires_at: now })
        .eq('user_id', user.id)
        .gt('expires_at', now);

      const { data, error: insertError } = await supabase
        .from('notices')
        .insert([{
          user_id: user.id,
          title: trimTitle,
          content: trimContent,
          expires_at: expiresAt.toISOString(),
        }])
        .select('id, title, content, expires_at')
        .single();

      if (insertError) throw insertError;

      setActiveNotice(data as ActiveNotice);
      resetNoticeForm();
      setMessage('Notice posted! It will appear in the shared view immediately.');
    } catch (err) {
      console.error('Error posting notice:', err);
      setError(isEditingNotice ? 'Unable to update the notice right now.' : 'Unable to post the notice right now.');
    } finally {
      setWorking(false);
    }
  };

  const handleStartEdit = () => {
    if (!activeNotice) return;

    setTitle(activeNotice.title);
    setContent(activeNotice.content);
    setExpiryMode('datetime');
    setExpiryDatetime(format(parseISO(activeNotice.expires_at), "yyyy-MM-dd'T'HH:mm"));
    setDurationHours('24');
    setIsEditingNotice(true);
    setMessage(null);
    setError(null);
  };

  const handleCancelEdit = () => {
    resetNoticeForm();
    setError(null);
    setMessage(null);
  };

  const handleDelete = async () => {
    if (!activeNotice || !user?.id) return;
    setWorking(true);
    setError(null);
    setMessage(null);

    try {
      const { error: deleteError } = await supabase
        .from('notices')
        .delete()
        .eq('id', activeNotice.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setActiveNotice(null);
      resetNoticeForm();
      setMessage('Notice removed from the shared view.');
    } catch (err) {
      console.error('Error deleting notice:', err);
      setError('Unable to delete the notice right now.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-emerald-500" />
          Post Notice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Post a notice that appears as a running ticker below the shared view header. Only one notice is active at a time.
        </p>

        {loading && (
          <p className="text-sm text-muted-foreground">Loading notice status...</p>
        )}

        {/* Post new notice form */}
        <form onSubmit={handleSubmitNotice} className="space-y-4">
          <p className="text-sm font-medium text-slate-700">
            {isEditingNotice
              ? 'Edit active notice:'
              : activeNotice
                ? 'Post a new notice (replaces the active one):'
                : 'Post a notice:'}
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="notice-title">Title</label>
            <Input
              id="notice-title"
              placeholder="e.g. Important update for all members"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              disabled={working}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="notice-content">Content</label>
            <Textarea
              id="notice-content"
              placeholder="Write your notice message here..."
              rows={3}
              value={content}
              onChange={(e) => { setContent(e.target.value); setError(null); }}
              disabled={working}
              className="resize-none"
            />
          </div>

          {/* Expiry mode toggle */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Expiry</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpiryMode('hours')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  expiryMode === 'hours'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Duration (hours)
              </button>
              <button
                type="button"
                onClick={() => setExpiryMode('datetime')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  expiryMode === 'datetime'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Specific date & time
              </button>
            </div>

            {expiryMode === 'hours' ? (
              <div className="flex items-center gap-2">
                <Input
                  id="notice-duration"
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="24"
                  value={durationHours}
                  onChange={(e) => { setDurationHours(e.target.value); setError(null); }}
                  disabled={working}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">hours from now</span>
              </div>
            ) : (
              <Input
                id="notice-expiry"
                type="datetime-local"
                min={minDatetime}
                value={expiryDatetime}
                onChange={(e) => { setExpiryDatetime(e.target.value); setError(null); }}
                disabled={working}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="gap-2" disabled={working}>
              <Megaphone className="h-4 w-4" />
              {working
                ? isEditingNotice
                  ? 'Saving...'
                  : 'Posting...'
                : isEditingNotice
                  ? 'Save Notice'
                  : 'Post Notice'}
            </Button>
            {isEditingNotice ? (
              <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={working}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </form>

        {/* Active notice preview */}
        {!loading && activeNotice && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active Notice</p>
                <p className="truncate font-semibold text-slate-900">{activeNotice.title}</p>
                <p className="text-sm text-slate-700">{activeNotice.content}</p>
                <p className="text-xs text-emerald-700">
                  Expires {formatDistanceToNow(parseISO(activeNotice.expires_at), { addSuffix: true })}
                  <span className="text-emerald-600">
                    {' '}({format(parseISO(activeNotice.expires_at), 'dd MMM yyyy, hh:mm a')})
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  onClick={handleStartEdit}
                  disabled={working}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                  disabled={working}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-bold font-heading">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage app-level configuration for sharing and access.
        </p>
      </header>

      <CurrentCycleSettingsCard />
      <ShareSettingsCard />
      <NoticeSettingsCard />
    </div>
  );
}
