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
    default: { minLat: 29.22, maxLat: 29.36, minLng: 117.15, maxLng: 117.28 },
    clusters: {
      taoyang: { minLat: 29.304, maxLat: 29.321, minLng: 117.186, maxLng: 117.205 },
      taoxichuan: { minLat: 29.300, maxLat: 29.314, minLng: 117.201, maxLng: 117.221 },
      guyao: { minLat: 29.283, maxLat: 29.301, minLng: 117.168, maxLng: 117.191 },
      sanbao: { minLat: 29.255, maxLat: 29.281, minLng: 117.228, maxLng: 117.255 }
    }
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function relaxSketchPoints(points, bounds, minSpacing) {
  const next = points.map((point) => ({ ...point }));
  const iterations = 8;
  const maxX = bounds.width - 14;
  const maxY = bounds.height - 14;

  for (let round = 0; round < iterations; round += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.001);
        if (dist >= minSpacing) {
          continue;
        }

        const push = (minSpacing - dist) * 0.5;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x = clamp(a.x - ux * push, 14, maxX);
        a.y = clamp(a.y - uy * push, 14, maxY);
        b.x = clamp(b.x + ux * push, 14, maxX);
        b.y = clamp(b.y + uy * push, 14, maxY);
      }
    }
  }

  return next;
}

function buildRouteSketch(dayPlan, currentStepIndex) {
  if (!dayPlan || !Array.isArray(dayPlan.items)) {
    return null;
  }

  const rawPoints = dayPlan.items
    .filter((item) => isFiniteCoordinate(item.latitude) && isFiniteCoordinate(item.longitude))
    .map((item, index) => ({
      sequence: index + 1,
      title: item.placeName,
      placeType: item.placeType || 'spot',
      latitude: item.latitude,
      longitude: item.longitude,
      state: index < currentStepIndex ? 'done' : index === currentStepIndex ? 'current' : 'todo'
    }));

  if (!rawPoints.length) {
    return null;
  }

  const width = 150;
  const height = 108;
  const padding = 14;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const lats = rawPoints.map((point) => point.latitude);
  const lngs = rawPoints.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);
  const scale = Math.min(usableWidth / lngRange, usableHeight / latRange);
  const contentWidth = lngRange * scale;
  const contentHeight = latRange * scale;
  const offsetX = (usableWidth - contentWidth) / 2;
  const offsetY = (usableHeight - contentHeight) / 2;

  const points = rawPoints.map((point) => ({
    ...point,
    x: padding + offsetX + (point.longitude - minLng) * scale,
    y: padding + offsetY + (maxLat - point.latitude) * scale
  }));

  const relaxedPoints = relaxSketchPoints(points, { width, height }, 18);

  const segments = [];
  const bends = [];

  for (let index = 0; index < relaxedPoints.length - 1; index += 1) {
    const start = relaxedPoints[index];
    const end = relaxedPoints[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.max(distanceBetween(start, end), 1);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const nx = -dy / len;
    const ny = dx / len;
    const bendMagnitude = clamp(len * 0.18, 4, 10) * (index % 2 === 0 ? 1 : -1);
    const bend = {
      x: (start.x + end.x) / 2 + nx * bendMagnitude,
      y: (start.y + end.y) / 2 + ny * bendMagnitude
    };

    const firstLen = Math.max(distanceBetween(start, bend), 1);
    const secondLen = Math.max(distanceBetween(bend, end), 1);
    const firstAngle = (Math.atan2(bend.y - start.y, bend.x - start.x) * 180) / Math.PI;
    const secondAngle = (Math.atan2(end.y - bend.y, end.x - bend.x) * 180) / Math.PI;

    segments.push({
      width: firstLen,
      style: `left:${start.x}rpx;top:${start.y}rpx;width:${firstLen}rpx;transform:rotate(${firstAngle}deg);`,
      state: end.state
    });
    segments.push({
      width: secondLen,
      style: `left:${bend.x}rpx;top:${bend.y}rpx;width:${secondLen}rpx;transform:rotate(${secondAngle}deg);`,
      state: end.state
    });

    bends.push({
      style: `left:${bend.x}rpx;top:${bend.y}rpx;`,
      state: end.state
    });
  }

  return {
    width,
    height,
    points: relaxedPoints,
    segments,
    bends
  };
}

function decorateDayPlan(dayPlan, currentStepIndex) {
  if (!dayPlan || !Array.isArray(dayPlan.items)) {
    return dayPlan;
  }

  return {
    ...dayPlan,
    routeSketch: buildRouteSketch(dayPlan, currentStepIndex),
    items: dayPlan.items.map((item, index) => ({
      ...item,
      routeSketch: buildRouteSketch(dayPlan, index),
      progressIndex: index,
      progressState: index < currentStepIndex ? 'done' : index === currentStepIndex ? 'current' : 'todo',
      progressLiftClass: index % 2 === 0 ? 'lift-even' : 'lift-odd'
    }))
  };
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
    currentDayPlan: null,
    currentRouteStepIndex: 0,
    dayMap: null,
    mapScale: 13,
    routeRevealScale: 15,
    showRoutePolyline: false,
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
      currentDayPlan: route && route.dayPlans ? decorateDayPlan(route.dayPlans[0], 0) : null,
      currentRouteStepIndex: 0,
      dayMap: route ? this.buildDayMap(route, 0) : null,
      mapScale: 13,
      showRoutePolyline: false
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
    const dayClusters = Array.from(
      new Set(
        dayPlan.items
          .map((item) => item.areaCluster || getAreaCluster(item.area || item.placeName || ''))
          .filter((cluster) => cluster && cluster !== 'general')
      )
    );
    const hasMixedClusters = dayClusters.length > 1;

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
        if (!hasMixedClusters && clusterBounds && !isPointInBounds(point, clusterBounds)) {
          return false;
        }

        if (
          !hasMixedClusters &&
          dayCluster !== 'general' &&
          point.areaCluster !== 'general' &&
          point.areaCluster !== dayCluster &&
          point.placeType !== 'hotel'
        ) {
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

    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    return {
      markers: points.map((point, index) => {
        return {
          id: point.id,
          latitude: point.latitude,
          longitude: point.longitude,
          width: index === 0 || index === points.length - 1 ? 30 : 24,
          height: index === 0 || index === points.length - 1 ? 30 : 24,
          alpha: 0.98,
          label: {
            content: `${point.sequence}`,
            color: '#111827',
            fontSize: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(17, 24, 39, 0.10)',
            bgColor: 'rgba(255, 255, 255, 0.94)',
            padding: 4
          }
        };
      }),
      polylines: [
        {
          points: points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude
          })),
          color: this.data.mode === 'hardcore' ? '#8792a3' : '#b59b7a',
          width: 4,
          dottedLine: false
        }
      ],
      center: {
        latitude: startPoint.latitude,
        longitude: startPoint.longitude
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
        { label: typePalette.spot.label, color: '#8b6f47' },
        { label: typePalette.food.label, color: '#b45309' },
        { label: typePalette.hotel.label, color: '#6d28d9' }
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
    const nextDayPlan = this.data.route && this.data.route.dayPlans ? this.data.route.dayPlans[index] : null;
    this.setData({
      currentDayIndex: index,
      currentDayPlan: decorateDayPlan(nextDayPlan, 0),
      currentRouteStepIndex: 0,
      dayMap: this.buildDayMap(this.data.route, index),
      mapScale: 13,
      showRoutePolyline: false
    });
  },

  onRouteProgressTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index === this.data.currentRouteStepIndex) {
      return;
    }

    const currentDayPlan =
      this.data.route && this.data.route.dayPlans
        ? decorateDayPlan(this.data.route.dayPlans[this.data.currentDayIndex], index)
        : null;

    this.setData({
      currentRouteStepIndex: index,
      currentDayPlan
    });
  },

  onRouteMapRegionChange(e) {
    if (!e || !e.detail || e.detail.type !== 'end') {
      return;
    }

    const nextScale = Number(e.detail.scale);
    if (!Number.isFinite(nextScale)) {
      return;
    }

    const showRoutePolyline = nextScale >= this.data.routeRevealScale;
    if (nextScale === this.data.mapScale && showRoutePolyline === this.data.showRoutePolyline) {
      return;
    }

    this.setData({
      mapScale: nextScale,
      showRoutePolyline
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
