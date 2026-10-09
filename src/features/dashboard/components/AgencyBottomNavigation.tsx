import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';

import { colors } from '../../../styles/colors';
import { scaleFont, scaleHeight, scaleWidth } from '../../../styles/dimensions';
import ScalePressable from '../../../components/common/ScalePressable';

export type AgencyNavTab =
  | 'overview'
  | 'guards'
  | 'sites'
  | 'incidents'
  | 'plan'
  | 'profile';

type Props = {
  activeTab: AgencyNavTab;
  onTabPress?: (tab: AgencyNavTab) => void;
};

const tabs: Array<{
  key: AgencyNavTab;
  labelKey: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}> = [
  { key: 'overview', labelKey: 'dashboard', icon: 'layout' },
  { key: 'guards', labelKey: 'guard', icon: 'users' },
  { key: 'sites', labelKey: 'sites', icon: 'grid' },
  { key: 'incidents', labelKey: 'incidents', icon: 'alert-triangle' },
  { key: 'plan', labelKey: 'plan', icon: 'calendar' },
  { key: 'profile', labelKey: 'profile', icon: 'user' },
];

const AgencyBottomNavigation: React.FC<Props> = ({ activeTab, onTabPress }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const active = tab.key === activeTab;
        return (
          <ScalePressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress?.(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`dashboard.${tab.labelKey}`)}
          >
            <View pointerEvents="none" style={styles.tabContent}>
              <Feather
                name={tab.icon}
                size={scaleFont(28)}
                color={active ? '#2563EB' : colors.primary}
              />
              <Text style={[styles.label, active && styles.activeLabel]}>
                {t(`dashboard.${tab.labelKey}`)}
              </Text>
            </View>
          </ScalePressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: scaleHeight(69),
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    paddingHorizontal: scaleWidth(4),
    paddingBottom: scaleHeight(4),
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: scaleHeight(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scaleWidth(8),
    paddingHorizontal: scaleWidth(2),
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleHeight(2),
  },
  label: {
    fontWeight: '600',
    color: colors.primary,
    fontSize: scaleFont(11),
    textAlign: 'center',
  },
  activeLabel: { color: '#2563EB' },
});

export default AgencyBottomNavigation;
