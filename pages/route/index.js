const { destinations } = require('../../utils/travelData');
const { generateRoute } = require('../../utils/routePlanner');
const { saveRoute } = require('../../utils/storage');
const { sanitizeDestinations, sanitizeRoute } = require('../../utils/presentation');

const cleanDestinations = sanitizeDestinations(destinations);

const DESTINATION_BOUNDS = {
  suzhou: {
    default: { minLat: 31.08, maxLat: 31.36, minLng: 120.18, maxLng: 120.74 },
    clusters: {
      oldtown: { minLat: 31.295, maxLat: 31.34, minLng: 120.59, maxLng: 120.655 },
      jinji: { minLat: 31.285, maxLat: 31.315, minLng: 120.7, maxLng: 120.735 },
      xishan: { minLat: 31.09, maxLat: 31.135, minLng: 120.215, maxLng: 120.255 }
    }
  },
  sanya: {
    default: { minLat: 18.18, maxLat: 18.34, minLng: 109.34, maxLng: 109.79 },
    clusters: {
      haitang: { minLat: 18.26, maxLat: 18.34, minLng: 109.72, maxLng: 109.79 },
      yalong: { minLat: 18.22, maxLat: 18.27, minLng: 109.60, maxLng: 109.67 },
      urban: { minLat: 18.2, maxLat: 18.29, minLng: 109.46, maxLng: 109.53 }
    }
  },
  lingshui: {
    default: { minLat: 18.34, maxLat: 18.6, minLng: 109.92, maxLng: 110.07 }
  },
  wanning: {
    default: { minLat: 18.58, maxLat: 18.75, minLng: 110.22, maxLng: 110.31 }
  },
  jingdezhen: {
    default: { minLat: 29.22, maxLat: 29.36, minLng: 117.15, maxLng: 117.28 }
  }
};

function getAreaCluster(text) {
  const value = (text || '').toLowerCase();
  if (
    value.includes('haitang') ||
    value.includes('海棠湾') ||
    value.includes('后海') ||
    value.includes('蜈支洲')
  ) {
    return 'haitang';
  }
  if (
    value.includes('yalong') ||
    value.includes('亚龙湾') ||
    value.includes('太阳湾') ||
    value.includes('热带天堂') ||
    value.includes('小东海')
  ) {
    return 'yalong';
  }
  if (
    value.includes('urban') ||
    value.includes('鹿回头') ||
    value.includes('大东海') ||
    value.includes('三亚湾') ||
    value.includes('市区')
  ) {
    return 'urban';
  }
  if (value.includes('xishan') || value.includes('taihu')) {
    return 'xishan';
  }
  if (value.includes('jinji')) {
    return 'jinji';
  }
  if (value.includes('oldtown') || value.includes('pingjiang') || value.includes('shantang')) {
    return 'oldtown';
  }
  return 'general';
}

function isFiniteCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPointInBounds(point, bounds) {
  if (!bounds) return true;
  return (
    point.latitude >= bounds.minLat &&
    point.latitude <= bounds.maxLat &&
    point.longitude >= bounds.minLng &&
    point.longitude <= bounds.maxLng
  );
}

Page({
  data: {
    destination: '苏州',
    days: 3,
    mode: 'relaxed',
    budgetLevel: 'medium',
    preferences: ['美食', '拍照'],
    destinations: cleanDestinations.map((item) => item.name),
    route: null,
    currentDayIndex: 0,
    dayMap: null,
    modeMeta: {
      relaxed: {
        title: '松弛游',
        subtitle: '少赶路，多停留，给喝茶、散步和顺路小逛留出空间',
        badges: ['古城慢逛', '休息位更多', '适合拍照和情侣'],
        density: '低到中',
        energy: '舒服节奏'
      },
      hardcore: {
        title: '特种兵',
        subtitle: '优先覆盖经典点位，把顺路和效率放到更高优先级',
        badges: ['经典覆盖高', '转场更紧凑', '更吃体力'],
        density: '高',
        energy: '高强度推进'
      }
    }
  },

  onLoad(options) {
    const nextData = {};
    if (options.destination) nextData.destination = decodeURIComponent(options.destination);
    if (options.days) nextData.days = Number(options.days);
    if (options.mode) nextData.mode = options.mode;
    if (options.budgetLevel) nextData.budgetLevel = options.budgetLevel;
    if (options.preferences) {
      try {
        nextData.preferences = JSON.parse(decodeURIComponent(options.preferences));
      } catch (err) {}
    }
    this.setData(nextData, () => this.buildRoute());
  },

  buildRoute() {
    const route = sanitizeRoute(generateRoute({
      destination: this.data.destination,
      days: this.data.days,
      dailyHours: 'full_day',
      budgetLevel: this.data.budgetLevel,
      preferences: this.data.preferences,
      tripType: 'friends',
      mode: this.data.mode
    }));

    this.setData({
      route,
      currentDayIndex: 0,
      dayMap: route ? this.buildDayMap(route, 0) : null
    });
  },

  buildDayMap(route, dayIndex) {
    if (!route || !route.dayPlans || !route.dayPlans[dayIndex]) {
      return null;
    }

    const dayPlan = route.dayPlans[dayIndex];
    const destinationBounds = DESTINATION_BOUNDS[route.destinationId] || null;
    const dayCluster =
      dayPlan.items.map((item) => item.areaCluster).find((cluster) => cluster && cluster !== 'general') ||
      getAreaCluster(dayPlan.area);

    const typePalette = {
      spot: {
        color: this.data.mode === 'hardcore' ? '#1f2937' : '#8b6f47',
        label: '景点'
      },
      food: {
        color: '#c2410c',
        label: '餐饮'
      },
      hotel: {
        color: '#7c3aed',
        label: '住宿'
      },
      base: {
        color: '#0f766e',
        label: '休息/机动'
      }
    };

    const points = dayPlan.items
      .filter((item) => isFiniteCoordinate(item.latitude) && isFiniteCoordinate(item.longitude))
      .map((item) => ({
        title: item.placeName,
        latitude: item.latitude,
        longitude: item.longitude,
        placeType: item.placeType || 'spot',
        areaCluster: item.areaCluster || getAreaCluster(item.area || item.placeName || ''),
        trustLevel: item.trustLevel || (item.placeType === 'spot' ? 'high' : 'medium')
      }))
      .filter((point) => {
        if (!isPointInBounds(point, destinationBounds && destinationBounds.default)) {
          return false;
        }

        const clusterBounds =
          destinationBounds && destinationBounds.clusters ? destinationBounds.clusters[point.areaCluster] : null;
        if (clusterBounds && !isPointInBounds(point, clusterBounds)) {
          return false;
        }

        if (
          dayCluster !== 'general' &&
          point.areaCluster !== 'general' &&
          point.areaCluster !== dayCluster &&
          point.placeType !== 'hotel'
        ) {
          return false;
        }

        if (point.placeType === 'food' && point.trustLevel !== 'high') {
          return false;
        }

        if (point.placeType === 'hotel' && point.trustLevel === 'low') {
          return false;
        }

        return true;
      })
      .map((point, index) => ({
        ...point,
        id: index + 1,
        sequence: index + 1
      }));

    if (!points.length) {
      return {
        markers: [],
        polylines: [],
        center: null,
        pathNames: [],
        legend: []
      };
    }

    return {
      markers: points.map((point, index) => {
        const isStart = index === 0;
        const isEnd = index === points.length - 1;
        const palette = typePalette[point.placeType] || typePalette.spot;
        return {
          id: point.id,
          latitude: point.latitude,
          longitude: point.longitude,
          width: isStart || isEnd ? 34 : 28,
          height: isStart || isEnd ? 44 : 36,
          callout: {
            content: `${isStart ? '起点' : isEnd ? '终点' : `${point.sequence}.`} ${point.title}`,
            color: '#ffffff',
            fontSize: 12,
            borderRadius: 8,
            padding: 6,
            bgColor: isStart ? '#0f766e' : isEnd ? '#1f2937' : palette.color,
            display: 'ALWAYS'
          }
        };
      }),
      polylines: [
        {
          points: points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude
          })),
          color: this.data.mode === 'hardcore' ? '#1f2937' : '#8b6f47',
          width: 4,
          dottedLine: false
        }
      ],
      center: {
        latitude: points[0].latitude,
        longitude: points[0].longitude
      },
      pathNames: points.map((point) => ({
        title: point.title,
        placeType: point.placeType,
        sequence: point.sequence,
        color: (typePalette[point.placeType] || typePalette.spot).color,
        label: (typePalette[point.placeType] || typePalette.spot).label
      })),
      legend: [
        { label: '起点', color: '#0f766e' },
        { label: '终点', color: '#1f2937' },
        { label: typePalette.spot.label, color: typePalette.spot.color },
        { label: typePalette.food.label, color: typePalette.food.color },
        { label: typePalette.hotel.label, color: typePalette.hotel.color },
        { label: typePalette.base.label, color: typePalette.base.color }
      ]
    };
  },

  onModeTap(e) {
    this.setData({ mode: e.currentTarget.dataset.mode }, () => this.buildRoute());
  },

  onDestinationChange(e) {
    const destination = this.data.destinations[Number(e.detail.value)];
    this.setData({ destination }, () => this.buildRoute());
  },

  onDaysChange(e) {
    const day = Number(e.detail.value) + 1;
    this.setData({ days: day }, () => this.buildRoute());
  },

  onDayMapChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      currentDayIndex: index,
      dayMap: this.buildDayMap(this.data.route, index)
    });
  },

  onSaveRoute() {
    if (!this.data.route) return;
    saveRoute(this.data.route);
    wx.showToast({
      title: '路线已保存',
      icon: 'none'
    });
  }
});
