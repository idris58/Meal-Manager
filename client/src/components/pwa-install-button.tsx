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
  appName: string;
  installPath: string;
  className?: string;
  forceVisible?: boolean;
  size?: 'default' | 'sm';
};

export function PwaInstallButton({
  appName,
  installPath,
  className,
  forceVisible = false,
  size = 'sm',
}: PwaInstallButtonProps) {
  const { canInstall, isInstalled, isIos, promptInstall } = usePwaInstall();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!forceVisible && isInstalled) {
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

    setDialogOpen(true);
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
              {isIos
                ? 'Open this page in Safari, tap Share, then choose Add to Home Screen.'
                : `Open ${installPath} in your browser and use the browser install option for ${appName}. If another MealTrack app is already installed, open this route in a normal browser tab first.`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
            <p className="font-medium">Install route</p>
            <p className="mt-1 break-all text-muted-foreground">{installPath}</p>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
