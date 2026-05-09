const FAVORITE_KEY = 'travel_favorites_v1';
const ROUTE_SAVE_KEY = 'travel_route_saves_v1';
const HISTORY_KEY = 'travel_history_v1';

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value ? value : fallback;
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  wx.setStorageSync(key, value);
  return value;
}

function listFavorites() {
  return read(FAVORITE_KEY, []);
}

function saveFavorite(item) {
  const favorites = listFavorites();
  const next = favorites.some((f) => f.id === item.id && f.type === item.type)
    ? favorites
    : [item, ...favorites];
  return write(FAVORITE_KEY, next);
}

function removeFavorite(id) {
  return write(
    FAVORITE_KEY,
    listFavorites().filter((item) => item.id !== id)
  );
}

function listRouteSaves() {
  return read(ROUTE_SAVE_KEY, []);
}

function saveRoute(route) {
  const saves = listRouteSaves();
  const record = {
    routeId: route.routeId,
    destination: route.destination,
    mode: route.mode,
    days: route.days,
    paceDesc: route.paceDesc,
    savedAt: new Date().toISOString()
  };
  return write(ROUTE_SAVE_KEY, [record, ...saves.filter((item) => item.routeId !== record.routeId)]);
}

function addHistory(item) {
  const history = read(HISTORY_KEY, []);
  return write(HISTORY_KEY, [item, ...history].slice(0, 20));
}

function listHistory() {
  return read(HISTORY_KEY, []);
}

module.exports = {
  listFavorites,
  saveFavorite,
  removeFavorite,
  listRouteSaves,
  saveRoute,
  addHistory,
  listHistory
};
