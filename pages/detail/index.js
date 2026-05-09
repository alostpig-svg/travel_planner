const { destinationMap } = require('../../utils/travelData');
const { saveFavorite, removeFavorite, listFavorites } = require('../../utils/storage');
const { sanitizeCity, sanitizeItem } = require('../../utils/presentation');

Page({
  data: {
    item: null,
    cityName: '',
    isFavorite: false
  },

  onLoad(options) {
    const city = sanitizeCity(destinationMap[decodeURIComponent(options.city || '')]);
    if (!city) return;

    const item = [...city.spots, ...city.foods, ...(city.hotels || [])].find((target) => target.id === options.id);
    if (!item) return;

    this.setData({
      item: sanitizeItem({
        ...item,
        cityName: city.name
      }),
      cityName: city.name,
      isFavorite: listFavorites().some((fav) => fav.id === item.id && fav.type === item.type)
    });
  },

  toggleFavorite() {
    const { item, isFavorite } = this.data;
    if (!item) return;

    if (isFavorite) {
      removeFavorite(item.id);
      this.setData({ isFavorite: false });
    } else {
      saveFavorite({
        id: item.id,
        type: item.type,
        name: item.name,
        cityName: item.cityName,
        summary: item.summary,
        updatedAt: item.updatedAt
      });
      this.setData({ isFavorite: true });
    }

    wx.showToast({
      title: isFavorite ? '已取消收藏' : '已收藏',
      icon: 'none'
    });
  }
});
