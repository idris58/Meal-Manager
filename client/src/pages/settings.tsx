import { useEffect, useState } from 'react';
import { Copy, ExternalLink, RefreshCcw, Share2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type ShareLinkConfig = {
  token: string;
  is_enabled: boolean;
};

function createShareToken() {
  return crypto.randomUUID().replace(/-/g, '');
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

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-bold font-heading">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage app-level configuration for sharing and access.
        </p>
      </header>

      <ShareSettingsCard />
    </div>
  );
}
