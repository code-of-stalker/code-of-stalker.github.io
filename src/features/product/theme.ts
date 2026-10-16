export const colors = {
  background: '#000000',
  surface: '#080900',
  accent: '#F5DD07',
  text: '#F5DD07',
  muted: '#B69D4B',
  faint: '#655E46',
  border: '#575007',
  error: '#F5A790',
  overlay: '#000000bb',
  track: '#f5dd0733',
  subtle: '#f5dd0719',
  iconTint: undefined as string | undefined,
  onAccent: '#000000',
};
export type ProductColors = typeof colors & { secondary?: string };
export const lightColors: ProductColors = {
  background: '#FAE18F', surface: '#F7D985', accent: '#FF6600',
  text: '#BE4C00', muted: '#BE4C00', faint: '#BE4C00', border: '#BE4C00',
  error: '#A42010', overlay: '#be4c0055', track: '#ff660033', subtle: '#ff660019',
  iconTint: '#FF6600',
  onAccent: '#411300',
};
// Cool surfaces, teal controls and warm main text; muted labels stay readable.
export const neutralColors: ProductColors = {
  background: '#0D1520', surface: '#15212E', accent: '#86C9C7', text: '#E4E7DD',
  muted: '#A1B0B5', faint: '#8199A6', border: '#3B5361', error: '#E1A395',
  overlay: '#0d1520bb', track: '#86c9c733', subtle: '#86c9c719',
  iconTint: '#86C9C7', onAccent: '#0D1520',
};

export const violetColors: ProductColors = {
  background: '#0D1426', surface: '#192641', accent: '#6296F5', secondary: '#9869DA', text: '#8DB5F0',
  muted: '#7897C6', faint: '#57739F', border: '#45638E', error: '#B787D5',
  overlay: '#0d1426bb', track: '#6296f533', subtle: '#6296f519',
  iconTint: '#6296F5', onAccent: '#0D1426',
};
export const fonts = { title: 'Tektur', body: 'DisketMono', bodyBold: 'DisketMonoBold' };
