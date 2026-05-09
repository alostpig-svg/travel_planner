const { destinations, destinationMap } = require('../../utils/travelData');
const { sanitizeDestinations, sanitizeCity } = require('../../utils/presentation');

const cleanDestinations = sanitizeDestinations(destinations);

Page({
  data: {
    destinations: cleanDestinations,
    currentCity: cleanDestinations[0],
    category: 'all'
  },

  onLoad(options) {
    if (options.city) {
      const city = destinationMap[decodeURIComponent(options.city)];
      if (city) {
        this.setData({ currentCity: sanitizeCity(city) });
      }
    }
  },

  onSelectCity(e) {
    const city = this.data.destinations[e.currentTarget.dataset.index];
    this.setData({ currentCity: sanitizeCity(city) });
  },

  onFilterTap(e) {
    this.setData({ category: e.currentTarget.dataset.value });
  },

  onOpenDetail(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/index?city=${encodeURIComponent(this.data.currentCity.name)}&id=${id}&type=${type}`
    });
  }
});
