import {
  safe,
  noNulls,
  noDuplicates,
} from '../common';
import {
  APPEARANCE_DEFAULT,
  getStatelessAppearanceMapping,
  getStatelessVariantMapping,
  getStateAppearanceMapping,
  getStateVariantMapping,
  ThemeMappingType,
  ComponentMappingType,
} from '../mapping';
import { StyleMappingType } from './type';

export const SEPARATOR_MAPPING_ENTRY = '.';

/**
 * Creates style object for variant/list of variants(optional) and its state/list of states(optional)
 *
 * Example
 *
 * appearance = 'outline';
 * variants = ['success', 'large'];
 * state = ['active', 'checked'];
 *
 * a = `default` + `outline`                    - acc appearance (apce) mapping
 *
 * v1 = `success` of `default`                  - `success` variant mapping of `default` apce
 * v2 = `success` of `outline`                  - `success` variant mapping of `outline` apce
 * v3 = `large` of `default`                    - `large` variant mapping of `default` apce
 * v4 = `large` of `outline`                    - `large` variant mapping of `outline` apce
 *
 * s1 = `active` of `default`                   - `active` state mapping of `default` apce
 * s2 = `active` of `outline`                   - `active` state mapping of `outline` apce
 * s3 = `active` of `default success`           - `active` state mapping of `success` variant of `default` apce
 * s4 = `active` of `outline success`           - `active` state mapping of `success` variant of `outline` apce
 * s5 = `active` of `default large`             - `active` state mapping of `large` variant of `default` apce
 * s6 = `active` of `outline large`             - `active` state mapping of `large` variant of `outline` apce
 *
 * s7 = `checked` of `default`                  - `checked` state mapping of `default` apce
 * s8 = `checked` of `outline`                  - `checked` state mapping of `outline` apce
 * s9 = `checked` of `default success`          - `checked` state mapping of `success` variant of `default` apce
 * s10 = `checked` of `outline success`         - `checked` state mapping of `success` variant of `outline` apce
 * s11 = `checked` of `default large`           - `checked` state mapping of `large` variant of `default` apce
 * s12 = `checked` of `outline large`           - `checked` state mapping of `large` variant of `outline` apce
 *
 * s13 = `active.checked` of `default`          - `active.checked` state mapping of `default` apce
 * s14 = `active.checked` of `outline`          - `active.checked` state mapping of `outline` apce
 * s15 = `active.checked` of `default success`  - `active.checked` state mapping of `success` variant of `default` apce
 * s16 = `active.checked` of `outline success`  - `active.checked` state mapping of `success` variant of `outline` apce
 * s17 = `active.checked` of `default large`    - `active.checked` state mapping of `large` variant of `default` apce
 * s18 = `active.checked` of `outline large`    - `active.checked` state mapping of `large` variant of `outline` apce
 *
 * res = a + (v1 + v2 + ... + vn) + (s1 + s2 + ... + sn)
 *
 * @param mapping: ThemeMappingType - theme mapping configuration
 * @param component: string - component name
 * @param appearance: string - appearance applied to component
 * @param variants: string[] - variants applied to component. Default is []
 * @param states: string[] - states in which component is. Default is []
 *
 * @return StyleType - compiled component styles declared in mappings, mapped to theme values
 */
export function createStyle(mapping: ThemeMappingType,
                            component: string,
                            appearance: string = APPEARANCE_DEFAULT,
                            variants: string[] = [],
                            states: string[] = []): StyleMappingType {

  const normalizedAppearance = normalizeAppearance(appearance);
  const normalizedVariants = normalizeVariants(variants);
  const normalizedStates = normalizeStates(states, (state: string) => {
    return states.indexOf(state);
  });

  const appearanceMapping = reduce(normalizedAppearance, apce => {
    return getStatelessAppearanceMapping(mapping, component, apce);
  });

  const variantMapping = reduce(normalizedVariants, variant => {
    return reduce(normalizedAppearance, apce => {
      return getStatelessVariantMapping(mapping, component, apce, variant);
    });
  });

  const stateMapping = reduce(normalizedStates, state => {
    const appearanceStateMapping = reduce(normalizedAppearance, apce => {
      return getStateAppearanceMapping(mapping, component, apce, state);
    });

    const variantStateMapping = reduce(normalizedVariants, variant => {
      return reduce(normalizedAppearance, apce => {
        return getStateVariantMapping(mapping, component, apce, variant, state);
      });
    });

    return {...appearanceStateMapping, ...variantStateMapping};
  });

  return {...appearanceMapping, ...variantMapping, ...stateMapping};
}

export function createAllStyles(mapping: ThemeMappingType,
                                component: string,
                                appearance: string,
                                variants: string[],
                                states: string[]): StyleMappingType[] {

  const stateless = createStyleEntry(mapping, component, appearance, appearance);

  const withStates = states.reduce((acc: [string, StyleMappingType][], current: string) => {
    const key = appearance.concat(SEPARATOR_MAPPING_ENTRY, current);
    const next = createStyleEntry(mapping, component, key, appearance, '', current);
    return [...acc, next];
  }, []);

  const withVariants = variants.map(variant => {
    const key = appearance.concat(SEPARATOR_MAPPING_ENTRY, variant);
    return createStyleEntry(mapping, component, key, appearance, variant);
  });

  const withVariantStates = variants.reduce((acc: [string, StyleMappingType][], current: string) => {
    const next = states.map(state => {
      const key = appearance.concat(SEPARATOR_MAPPING_ENTRY, current, SEPARATOR_MAPPING_ENTRY, state);
      return createStyleEntry(mapping, component, key, appearance, current, state);
    });
    return [...acc, ...next];
  }, []);

  return [
    stateless,
    ...withStates,
    ...withVariants,
    ...withVariantStates,
  ];
}

export function getStyle(mapping: ThemeMappingType,
                         component: string,
                         appearance: string,
                         variants: string[],
                         states: string[]): StyleMappingType | undefined {

  return safe(mapping, (themeMapping: ThemeMappingType) => {
    return safe(themeMapping[component], (componentMapping: ComponentMappingType) => {

      const query = findStyleKey(Object.keys(componentMapping), [
        appearance,
        ...variants,
        ...states,
      ]);

      return componentMapping[query];
    });
  });
}

/**
 * Creates normalized to design system array of component appearances
 *
 * Example:
 *
 * '' => ['default']
 * 'bold' => ['default', 'bold']
 * 'default' => ['default']
 * ...
 *
 * @param appearance: string - appearance applied to component
 *
 * @return string[] - array of merged appearances
 */
export function normalizeAppearance(appearance: string): string[] {
  return normalize([APPEARANCE_DEFAULT, appearance]);
}

/**
 * Creates normalized to design system array of component variants
 *
 * Example:
 *
 * [''] => []
 * ['success'] => ['success']
 * ['success', 'tiny'] => ['success', 'tiny']
 * ...
 *
 * @param variants: string[] - variants applied to component
 *
 * @return string[] - array of merged variants
 */
export function normalizeVariants(variants: string[]): string[] {
  return normalize(variants);
}

/**
 * Creates normalized to design system array of component states
 *
 * Example:
 *
 * [''] => []
 * ['active'] => ['active']
 * ['active', 'checked'] => ['active', 'checked', 'active.checked']
 * ['active', 'checked', 'disabled'] => ['active', 'checked', 'active.checked', 'disabled', 'active.checked.disabled']
 * ...
 *
 * @param states: string[] - states in which component is
 * @param stateWeight: (state: string) => number - state weight calculation lambda
 * @param separator - state separator. `.` in example
 *
 * @return string[] - array of merged states
 */
export function normalizeStates(states: string[],
                                stateWeight: (state: string) => number,
                                separator: string = SEPARATOR_MAPPING_ENTRY): string[] {

  const preprocess = normalize(states);
  if (preprocess.length === 0) {
    return preprocess;
  } else {
    const variations = createStateVariations([...preprocess], separator, []);

    return variations.sort((lhs: string, rhs: string) => {
      const lhsWeight = getStateVariationWeight(lhs, separator, stateWeight);
      const rhsWeight = getStateVariationWeight(rhs, separator, stateWeight);
      return lhsWeight - rhsWeight;
    });
  }
}

function createStateVariations(states: string[], separator: string, result: string[] = []): string[] {
  if (states.length === 0) {
    return result;
  }

  const next = states.reduce((acc: string[], current: string) => {
    const next = acc.map(value => value.concat(separator, current));
    return [...acc, ...next];
  }, [states.shift()]);

  return createStateVariations(states, separator, [...result, ...next]);
}

function getStateVariationWeight(state: string,
                                 separator: string,
                                 stateWeight: (state: string) => number): number {

  const parts = state.split(separator);
  return parts.reduce((acc: number, current: string): number => {
    return acc + stateWeight(current) + parts.length;
  }, 0);
}

/**
 * Finds identical keys across `source` keys array
 *
 * Example:
 *
 * source = ['default.error.small.checked', ...]
 * query = ['default', 'small', 'error', 'checked']
 *
 * will return 'default.error.small.checked'
 *
 * @param source (string[]) - array of style keys
 * @param query (string[]) - array of key parts to search
 *
 * @return (string | undefined) - key identical to some of `source` keys if presents
 */
export function findStyleKey(source: string[], query: string[]): string | undefined {

  const partialKeys: string[][] = source.map((key: string) => {
    return key.split(SEPARATOR_MAPPING_ENTRY);
  });

  const result: string[][] = partialKeys.filter((partial: string[]) => {
    return compareArrays(query, partial);
  });

  return safe(result[0], (value: string[]) => {
    return value.join(SEPARATOR_MAPPING_ENTRY);
  });
}

function createStyleEntry(mapping: ThemeMappingType,
                          component: string,
                          key: string,
                          appearance: string,
                          variant: string = '',
                          state: string = ''): [string, StyleMappingType] {

  const value = createStyle(
    mapping,
    component,
    appearance,
    variant.split(SEPARATOR_MAPPING_ENTRY),
    state.split(SEPARATOR_MAPPING_ENTRY),
  );

  return [key, value];
}

function normalize(params: string[]): string[] {
  return noNulls(noDuplicates(params));
}

function compareArrays(lhs: string[], rhs: string[]): boolean {
  const isEqualLength = lhs && rhs && lhs.length === rhs.length;
  if (!isEqualLength) {
    return false;
  }

  return lhs.reduce((acc: boolean, next: string): boolean => acc && rhs.includes(next), true);
}

function reduce(items: string[], next: (item: string) => any): any {
  return items.reduce((acc, current) => ({...acc, ...next(current)}), {});
}
