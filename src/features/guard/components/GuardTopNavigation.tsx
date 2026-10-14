import React from 'react';
import AgencyTopNavigation from '../../dashboard/components/AgencyTopNavigation';
import { useAuth } from '../../authentication/context/AuthContext';

type Props = {
  profileMenuOpen: boolean;
  onProfilePress: () => void;
  avatarInitials?: string;
  onNotificationSelect?: () => void;
};

/** Guard screens intentionally reuse the established Sentry header and notification panel. */
const GuardTopNavigation: React.FC<Props> = ({
  profileMenuOpen,
  onProfilePress,
  avatarInitials,
  onNotificationSelect,
}) => {
  const { user } = useAuth();
  const authInitial =
    (user?.full_name ?? '').trim().charAt(0).toUpperCase() || 'U';
  // While duty data is still loading callers may forward a placeholder "U";
  // in that case fall back to the authenticated user's real initial.
  const resolvedInitials =
    !avatarInitials || avatarInitials === 'U' ? authInitial : avatarInitials;

  return (
    <AgencyTopNavigation
      profileMenuOpen={profileMenuOpen}
      onProfilePress={onProfilePress}
      avatarInitials={resolvedInitials}
      onNotificationSelect={onNotificationSelect}
      enableIncidentBuzzer={false}
    />
  );
};

export default GuardTopNavigation;
