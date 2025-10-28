import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield } from "lucide-react";
import { useState } from "react";

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

export function BlockUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: BlockUserDialogProps) {
  const { toast } = useToast();
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlock = async () => {
    setIsBlocking(true);

    try {
      await apiRequest(`/api/users/${userId}/block`, {
        method: "POST",
      });

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/users/blocked"] });

      toast({
        title: "User blocked",
        description: `${userName} has been blocked. You won't see their profile anymore.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Failed to block user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-block-user">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle>Block {userName}?</AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="pt-2">
            Blocking {userName} will:
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Remove any existing matches with them</li>
              <li>Prevent them from appearing in your discovery feed</li>
              <li>Prevent them from messaging you</li>
            </ul>
            <p className="mt-3">
              You can unblock them later from your settings if you change your mind.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBlocking} data-testid="button-cancel-block">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBlock}
            disabled={isBlocking}
            className="bg-destructive hover:bg-destructive/90"
            data-testid="button-confirm-block"
          >
            {isBlocking ? "Blocking..." : "Block User"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
