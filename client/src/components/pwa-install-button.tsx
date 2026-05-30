import { useState } from 'react';
import { CloudDownload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/lib/pwa';

type PwaInstallButtonProps = {
  appId: 'main' | 'shared';
  appName: string;
  className?: string;
  size?: 'default' | 'sm';
};

export function PwaInstallButton({
  appId,
  appName,
  className,
  size = 'sm',
}: PwaInstallButtonProps) {
  const { canInstall, isInstalled, promptInstall } = usePwaInstall(appId);
  const [message, setMessage] = useState<string | null>(null);

  if (isInstalled || !canInstall) {
    return null;
  }

  const handleInstall = async () => {
    setMessage(null);

    if (canInstall) {
      const result = await promptInstall();

      if (result.outcome === 'accepted') {
        setMessage(`${appName} install started. Finish the browser install flow.`);
        return;
      }

      setMessage('Install was dismissed. You can try again from this button.');
      return;
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={className}
        onClick={handleInstall}
      >
        <CloudDownload className="h-4 w-4" />
        <span>Install App</span>
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
