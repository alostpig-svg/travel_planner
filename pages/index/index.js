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

const foodPreviewDishNames = {
  suzhou: {
    sz_food_1: '松鼠桂鱼',
    sz_food_2: '响油鳝丝',
    sz_food_3: '生煎',
    sz_food_4: '蟹黄面',
    sz_food_5: '枫镇大肉面',
    sz_food_6: '毛蟹年糕',
    sz_food_7: '腌笃鲜',
    sz_food_8: '苏式糕团'
  },
  sanya: {
    hn_food_1: '文昌鸡',
    hn_food_3: '椰子鸡',
    hn_food_4: '糟粕醋火锅',
    hn_food_5: '海南鸡饭',
    hn_food_10: '清补凉',
    hn_food_13: '椰子甜品',
    hn_food_14: '椰子饭'
  },
  jingdezhen: {
    jdz_food_1: '冷粉',
    jdz_food_2: '饺子粑',
    jdz_food_4: '瓷泥煨鸡',
    jdz_food_5: '碱水粑',
    jdz_food_6: '牛骨粉',
    jdz_food_9: '辣椒粑',
    jdz_food_10: '油条包麻糍'
  }
};

const spotPreviewCovers = {
  suzhou: {
    sz_spot_1: '/assets/discovery-previews/spots/suzhou-zhuozhengyuan.png',
    sz_spot_2: '/assets/discovery-previews/spots/suzhou-suzhou-museum.png',
    sz_spot_3: '/assets/discovery-previews/spots/suzhou-pingjiang-road.png',
    sz_spot_5: '/assets/discovery-previews/spots/suzhou-tiger-hill.png',
    sz_spot_14: '/assets/discovery-previews/spots/suzhou-xishan-island.png'
  },
  jingdezhen: {
    jdz_spot_1: '/assets/discovery-previews/spots/jingdezhen-taoyangli.png',
    jdz_spot_2: '/assets/discovery-previews/spots/jingdezhen-imperial-kiln-museum.png',
    jdz_spot_3: '/assets/discovery-previews/spots/jingdezhen-taoxichuan.png',
    jdz_spot_4: '/assets/discovery-previews/spots/jingdezhen-ceramic-village.png'
  },
  sanya: {
    hn_spot_1: '/assets/discovery-previews/spots/sanya-houhai.png',
    hn_spot_3: '/assets/discovery-previews/spots/sanya-sun-bay-road.png',
    hn_spot_2: '/assets/discovery-previews/spots/sanya-wuzhizhou.png',
    hn_spot_4: '/assets/discovery-previews/spots/sanya-luhuitou.png'
  }
};

const foodPreviewCovers = {
  suzhou: {
    sz_food_1: '/assets/discovery-previews/foods/suzhou-songshu-guiyu.png',
    sz_food_2: '/assets/discovery-previews/foods/suzhou-xiangyou-shansi.png',
    sz_food_3: '/assets/discovery-previews/foods/suzhou-shengjian.png',
    sz_food_4: '/assets/discovery-previews/foods/suzhou-xiehuangmian.png'
  },
  sanya: {
    hn_food_1: '/assets/discovery-previews/foods/sanya-wenchangji.png',
    hn_food_3: '/assets/discovery-previews/foods/sanya-yezi-ji.png',
    hn_food_4: '/assets/discovery-previews/foods/sanya-zaopocuohuoguo.png',
    hn_food_10: '/assets/discovery-previews/foods/sanya-qingbuliang.png'
  },
  jingdezhen: {
    jdz_food_1: '/assets/discovery-previews/foods/jingdezhen-lengfen.png',
    jdz_food_2: '/assets/discovery-previews/foods/jingdezhen-jiaoziba.png',
    jdz_food_4: '/assets/discovery-previews/foods/jingdezhen-cini-weiji.png',
    jdz_food_6: '/assets/discovery-previews/foods/jingdezhen-niuroufen.png'
  }
};

function getPreviewDishName(cityId, item) {
  const cityDishNames = foodPreviewDishNames[cityId] || {};
  return cityDishNames[item.id] ||
    (item.tasteTags && item.tasteTags[0]) ||
    item.foodType ||
    (Array.isArray(item.tags) && item.tags.length ? item.tags[0] : '') ||
    item.name;
}

function getPreviewCover(cityId, itemId, kind, fallbackCover) {
  const coverMap = kind === 'spot' ? spotPreviewCovers : foodPreviewCovers;
  const cityCovers = coverMap[cityId] || {};
  return cityCovers[itemId] || fallbackCover;
}

function buildLoopItems(items, cardCover, kind, cityId) {
  const sorted = [...(items || [])]
    .sort((a, b) => (b.recommendScore || 0) - (a.recommendScore || 0))
    .slice(0, 4);

  const fallbackItems = sorted.length
    ? sorted
    : [
        {
          id: `${kind}_fallback`,
          name: kind === 'spot' ? 'City Landmark' : 'Local Favorite',
          area: ''
        }
      ];

  const prepared = fallbackItems.map((item, index) => ({
    id: `${item.id}_${index}`,
    name: item.name,
    area: item.area || '',
    tag: kind === 'spot' ? 'Landmark' : 'Food',
    dishName:
      kind === 'food'
        ? getPreviewDishName(cityId, item)
        : '',
    cover: getPreviewCover(cityId, item.id, kind, cardCover),
    tone: `${kind}-${index % 4}`
  }));

  return prepared.map((item, index) => ({
    ...item,
    loopId: `${item.id}_loop_${index}`
  }));
}

function buildClusterItems(items, activeIndex) {
  const slots = ['center', 'ring-a', 'ring-b', 'ring-c'];
  return (items || []).map((item, index) => {
    const offset = (index - activeIndex + slots.length) % slots.length;
    return {
      ...item,
      slot: slots[offset],
      active: offset === 0
    };
  });
}

function buildCityDiscoveryPreview(city, spotIndex, foodIndex) {
  const spotItems = buildLoopItems(city.spots, city.cardCover, 'spot', city.id);
  const foodItems = buildLoopItems(city.foods, city.cardCover, 'food', city.id);

  return {
    spotItems: buildClusterItems(spotItems, spotIndex),
    foodItems: buildClusterItems(foodItems, foodIndex)
  };
}

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
    spotPreviewIndex: 0,
    foodPreviewIndex: 0,
    spotStageStyle: 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);',
    foodStageStyle: 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);',
    cityDiscoveryPreview: buildCityDiscoveryPreview(decoratedDestinations[0], 0, 0),
  },

  onLoad() {
    this.buildPreview();
  },

  buildPreview() {
    const city = this.data.destinations[this.data.destinationIndex];
    this.setData({
      cityMapPreview: buildCityMapPreview(city),
      cityDiscoveryPreview: buildCityDiscoveryPreview(city, 0, 0),
      spotPreviewIndex: 0,
      foodPreviewIndex: 0,
      spotStageStyle: 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);',
      foodStageStyle: 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);'
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

  updatePreviewIndex(kind, delta) {
    const city = this.data.destinations[this.data.destinationIndex];
    const items = kind === 'spot' ? city.spots || [] : city.foods || [];
    const size = Math.min(items.length, 4);
    if (!size) {
      return;
    }

    const key = kind === 'spot' ? 'spotPreviewIndex' : 'foodPreviewIndex';
    const next = (this.data[key] + delta + size) % size;
    this.setData({
      [key]: next,
      [kind === 'spot' ? 'spotStageStyle' : 'foodStageStyle']: 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);',
      cityDiscoveryPreview: buildCityDiscoveryPreview(
        city,
        kind === 'spot' ? next : this.data.spotPreviewIndex,
        kind === 'food' ? next : this.data.foodPreviewIndex
      )
    });
  },

  onPreviewTouchStart(e) {
    this._previewTouchStartX = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
    this._previewTouchKind = e.currentTarget.dataset.kind;
    this._previewTouchMoved = false;
  },

  onPreviewTouchMove(e) {
    const currentX = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
    const dx = currentX - (this._previewTouchStartX || 0);
    const kind = e.currentTarget.dataset.kind;
    const limited = Math.max(-28, Math.min(28, dx));
    this._previewTouchMoved = true;
    this.setData({
      [kind === 'spot' ? 'spotStageStyle' : 'foodStageStyle']: `transform: translate3d(${limited}px, 0, 0); transition: none;`
    });
  },

  onPreviewTouchEnd(e) {
    const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
    const dx = endX - (this._previewTouchStartX || 0);
    const kind = e.currentTarget.dataset.kind;
    const styleKey = kind === 'spot' ? 'spotStageStyle' : 'foodStageStyle';
    const resetStyle = 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);';
    if (Math.abs(dx) < 36) {
      this.setData({
        [styleKey]: resetStyle
      });
      return;
    }
    this.updatePreviewIndex(kind, dx > 0 ? -1 : 1);
    this.setData({
      [styleKey]: resetStyle
    });
  },

  onPreviewTouchCancel(e) {
    const kind = e.currentTarget.dataset.kind;
    this.setData({
      [kind === 'spot' ? 'spotStageStyle' : 'foodStageStyle']: 'transform: translate3d(0, 0, 0); transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);'
    });
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
