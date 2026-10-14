import React from 'react';
import AgencyTopNavigation from '../../dashboard/components/AgencyTopNavigation';
import { useAuth } from '../../authentication/context/AuthContext';

export default function ClientTopNavigation({
  profileMenuOpen,
  onProfilePress,
  onNotificationOpen,
  avatarInitials,
}: {
  profileMenuOpen: boolean;
  onProfilePress: () => void;
  onNotificationOpen?: () => void;
  avatarInitials?: string;
}) {
  const { user } = useAuth();
  const authInitial =
    (user?.full_name ?? '').trim().charAt(0).toUpperCase() || 'U';
  // While portal data is still loading callers may forward a placeholder "U";
  // in that case fall back to the authenticated user's real initial.
  const resolvedInitials =
    !avatarInitials || avatarInitials === 'U' ? authInitial : avatarInitials;

  return (
    <AgencyTopNavigation
      profileMenuOpen={profileMenuOpen}
      onProfilePress={onProfilePress}
      onBeforeOpenNotifications={onNotificationOpen}
      avatarInitials={resolvedInitials}
      enableIncidentBuzzer={false}
    />
  );
}
