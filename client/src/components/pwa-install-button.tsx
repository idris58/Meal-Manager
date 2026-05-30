import { useState } from 'react';
import { CloudDownload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const { canInstall, isInstalled, isIos, promptInstall } = usePwaInstall(appId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (isInstalled || (!canInstall && !isIos)) {
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

    if (isIos) {
      setDialogOpen(true);
    }
  };

  return (
    <>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install {appName}</DialogTitle>
            <DialogDescription>
              Open this page in Safari, tap Share, then choose Add to Home Screen.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </>
  );
}
