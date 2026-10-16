type FontSet = { load(font: string, text: string): PromiseLike<ArrayLike<unknown>> };

// Expo registers each file as a separate, normal-weight CSS family. Safari's
// Expo loader resolves after adding the rules, before downloading their files.
const probe = 'СЕГОДНЯ ПОЧУВСТВУЙ НАБЛЮДЕНИЕ Ёё «Я — есть» 0123456789';
const families = ['400 16px "DisketMono"', '400 16px "DisketMonoBold"', '400 20px "Tektur"', '400 20px "TekturMedium"', '400 20px "TekturSemiBold"'];

export async function waitForProductFonts(fonts: FontSet) {
  await Promise.all(families.map(async family => {
    const faces = await fonts.load(family, probe);
    if (!faces.length) throw new Error(`Не удалось загрузить шрифт ${family}`);
  }));
}
