export function saveEffectsReport(data: object) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `effects-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
