const { destinations } = require('../../utils/travelData');
const { generateRoute } = require('../../utils/routePlanner');
const { addHistory } = require('../../utils/storage');
const { sanitizeDestinations, sanitizeRoute } = require('../../utils/presentation');

const cleanDestinations = sanitizeDestinations(destinations);

Page({
  data: {
    destinationIndex: 0,
    selectedMode: 'relaxed',
    days: 3,
    budgetLevel: 'medium',
    preferences: ['food', 'photo'],
    destinations: cleanDestinations,
    routePreview: null
  },

  onLoad() {
    this.buildPreview();
  },

  buildPreview() {
    const city = this.data.destinations[this.data.destinationIndex];
    const route = generateRoute({
      destination: city.name,
      days: this.data.days,
      budgetLevel: this.data.budgetLevel,
      preferences: this.data.preferences,
      tripType: 'friends',
      mode: this.data.selectedMode
    });

    this.setData({
      routePreview: sanitizeRoute(route)
    });
  },

  onSelectDestination(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ destinationIndex: index }, () => this.buildPreview());
  },

  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ selectedMode: mode }, () => this.buildPreview());
  },

  onDaysChange(e) {
    this.setData({ days: Number(e.detail.value) + 1 }, () => this.buildPreview());
  },

  onBudgetChange(e) {
    const levels = ['low', 'medium', 'high'];
    this.setData({ budgetLevel: levels[Number(e.detail.value)] }, () => this.buildPreview());
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
      `budgetLevel=${this.data.budgetLevel}`,
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
