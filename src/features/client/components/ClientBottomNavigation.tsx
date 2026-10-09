import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import ScalePressable from '../../../components/common/ScalePressable';
import { colors } from '../../../styles/colors';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { scaleFont, scaleHeight } from '../../../styles/dimensions';

export type ClientTab = 'home' | 'request' | 'invoices' | 'alerts' | 'profile';
const tabs: Array<{
  key: ClientTab;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}> = [
  { key: 'home', label: 'client.home', icon: 'layout' },
  { key: 'request', label: 'client.request', icon: 'plus' },
  { key: 'invoices', label: 'client.invoices', icon: 'dollar-sign' },
  { key: 'alerts', label: 'client.alerts', icon: 'alert-triangle' },
  { key: 'profile', label: 'client.profile', icon: 'user' },
];

export default function ClientBottomNavigation({
  activeTab,
  onTabPress,
}: {
  activeTab: ClientTab;
  onTabPress: (tab: ClientTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.bar}>
      {tabs.map(tab => {
        const active = tab.key === activeTab;
        return (
          <ScalePressable
            key={tab.key}
            style={s.tab}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(tab.label)}
          >
            <Feather
              name={tab.icon}
              size={scaleFont(25)}
              color={active ? colors.status.info : colors.primary}
            />
            <Text style={[s.label, active && s.active]}>{t(tab.label)}</Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    minHeight: scaleHeight(69),
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    gap: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  label: {
    color: colors.primary,
    fontSize: scaleFont(typography.sizes.xs),
    fontWeight: typography.weights.semiBold,
    textAlign: 'center',
  },
  active: { color: colors.status.info },
});
