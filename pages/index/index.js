const { destinations } = require('../../utils/travelData');
const { addHistory } = require('../../utils/storage');
const { sanitizeDestinations } = require('../../utils/presentation');

const cleanDestinations = sanitizeDestinations(destinations);
const cityCardCovers = {
  suzhou: '/assets/city-covers/suzhou.svg',
  jingdezhen: '/assets/city-covers/jingdezhen.svg',
  sanya: '/assets/city-covers/sanya.svg',
  lingshui: '/assets/city-covers/lingshui.svg',
  wanning: '/assets/city-covers/wanning.svg',
  hainan: '/assets/city-covers/hainan.svg'
};
const decoratedDestinations = cleanDestinations.map((city) => ({
  ...city,
  cardCover: cityCardCovers[city.id] || '/assets/city-covers/default.svg'
}));

function buildCityMapPreview(city) {
  const cityCenters = {
    suzhou: {
      latitude: 31.2989,
      longitude: 120.5853,
      scale: 10
    },
    jingdezhen: {
      latitude: 29.2926,
      longitude: 117.1784,
      scale: 10
    },
    sanya: {
      latitude: 18.2528,
      longitude: 109.5119,
      scale: 9
    }
  };

  const fallbackCenter = {
    latitude: 31.2304,
    longitude: 121.4737,
    scale: 5
  };

  const center = cityCenters[city.id] || fallbackCenter;

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    scale: center.scale,
    subtitle: `${city.name}位置预览`,
    markers: [
      {
        id: 1,
        latitude: center.latitude,
        longitude: center.longitude,
        width: 26,
        height: 26,
        alpha: 0.95,
        callout: {
          content: city.name,
          color: '#111827',
          fontSize: 11,
          borderRadius: 12,
          borderWidth: 0,
          bgColor: '#ffffff',
          padding: 6,
          display: 'ALWAYS'
        }
      }
    ]
  };
}

Page({
  data: {
    destinationIndex: 0,
    selectedMode: 'relaxed',
    days: 3,
    preferences: ['food', 'photo'],
    destinations: decoratedDestinations,
    cityMapPreview: buildCityMapPreview(decoratedDestinations[0]),
  },

  onLoad() {
    this.buildPreview();
  },

  buildPreview() {
    const city = this.data.destinations[this.data.destinationIndex];
    this.setData({
      cityMapPreview: buildCityMapPreview(city)
    });
  },

  onSelectDestination(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ destinationIndex: index }, () => this.buildPreview());
  },

  onCitySwiperChange(e) {
    const index = Number(e.detail.current);
    if (index === this.data.destinationIndex) {
      return;
    }
    this.setData({ destinationIndex: index }, () => this.buildPreview());
  },

  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ selectedMode: mode }, () => this.buildPreview());
  },

  onDaysChange(e) {
    this.setData({ days: Number(e.detail.value) + 1 }, () => this.buildPreview());
  },

  onDaysSelect(e) {
    const days = Number(e.currentTarget.dataset.days);
    if (!days || days === this.data.days) {
      return;
    }
    this.setData({ days }, () => this.buildPreview());
  },

  onPreferenceTap(e) {
    const value = e.currentTarget.dataset.value;
    const next = this.data.preferences.includes(value)
      ? this.data.preferences.filter((item) => item !== value)
      : [...this.data.preferences, value];

    this.setData({ preferences: next }, () => this.buildPreview());
  },

  goDestination() {
    wx.navigateTo({
      url: '/pages/destination/index'
    });
  },

  goRoute() {
    const city = this.data.destinations[this.data.destinationIndex];
    const params = [
      `destination=${encodeURIComponent(city.name)}`,
      `days=${this.data.days}`,
      `mode=${this.data.selectedMode}`,
      `budgetLevel=medium`,
      `preferences=${encodeURIComponent(JSON.stringify(this.data.preferences))}`
    ].join('&');

    addHistory({
      id: `${city.id}_${Date.now()}`,
      type: 'route',
      name: `${city.name} ${this.data.selectedMode === 'relaxed' ? 'Relaxed' : 'Fast'}`
    });

    wx.navigateTo({
      url: `/pages/route/index?${params}`
    });
  }
});
