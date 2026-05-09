const { destinationMap } = require('./travelData');

function preferenceScore(item, preferences) {
  const aliasMap = {
    food: ['美食', '小吃', '正餐', '咖啡', '甜品'],
    photo: ['拍照', '摄影', '景观'],
    night: ['夜景', '傍晚', '日落'],
    culture: ['人文', '古城', '历史']
  };
  const expanded = new Set();
  (preferences || []).forEach((pref) => {
    expanded.add(pref);
    (aliasMap[pref] || []).forEach((value) => expanded.add(value));
  });
  return (item.tags || []).some((tag) => expanded.has(tag)) ? 1 : 0.35;
}

function sortPlaces(places, preferences, mode) {
  const modeBoost = mode === 'hardcore' ? 0.08 : 0;
  return [...places]
    .map((item) => ({
      ...item,
      totalScore:
        (item.recommendScore || 0) * 0.45 +
        (item.freshnessScore || 0) * 0.25 +
        preferenceScore(item, preferences) * 0.2 +
        (1 - (item.marketingRiskScore || 0)) * 0.1 +
        modeBoost
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function normalizeText(item) {
  return [
    item.name,
    item.foodType,
    item.area,
    item.routeRole,
    ...(item.tags || []),
    ...(item.statusTags || []),
    ...(item.experienceTags || []),
    ...(item.tasteTags || [])
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getFoodRole(item) {
  const text = normalizeText(item);
  if (includesAny(text, ['正餐', '苏帮菜', '湖鲜', '农家乐', '本地口味', '小炒', '家常', '火锅', '融合菜', '西餐'])) {
    return 'mainMeal';
  }
  if (includesAny(text, ['咖啡', '茶饮', '下午茶', '茶馆', '甜品', '舒芙蕾', '抹茶', '酸奶', '鲜奶', '茶'])) {
    return 'drink';
  }
  if (includesAny(text, ['小吃', '生煎', '锅贴', '点心'])) {
    return 'snack';
  }
  if (includesAny(text, ['面馆', '苏式面', '面'])) {
    return 'lightMeal';
  }
  return 'mainMeal';
}

function getCuisineType(item) {
  const text = normalizeText(item);
  if (includesAny(text, ['火锅', '苏式火锅', '川味火锅'])) return 'hotpot';
  if (includesAny(text, ['融合菜', '融合西餐', '创意菜', '西餐', '牛排', '东南亚'])) return 'fusion';
  if (includesAny(text, ['家常热炒', '家常菜', '江浙家常', '苏州家常'])) return 'homeCooking';
  if (includesAny(text, ['苏帮菜', '家宴', '松鹤楼', '得月楼', '姑苏家宴'])) return 'subang';
  if (includesAny(text, ['湖鲜', '太湖', '农家乐'])) return 'lakefresh';
  if (includesAny(text, ['小炒', '本地口味'])) return 'homeCooking';
  if (includesAny(text, ['面馆', '苏式面', '面'])) return 'noodle';
  if (includesAny(text, ['小吃', '生煎', '锅贴', '点心'])) return 'snack';
  if (includesAny(text, ['咖啡'])) return 'coffee';
  if (includesAny(text, ['茶饮', '茶馆', '抹茶'])) return 'tea';
  if (includesAny(text, ['甜品', '舒芙蕾', '酸奶', '鲜奶'])) return 'dessert';
  return 'general';
}

function isMealAction(action) {
  return action.includes('午餐') || action.includes('晚餐');
}

function getFoodSlotKind(action) {
  if (action.includes('晚餐')) return 'dinner';
  if (action.includes('午餐')) return 'lunch';
  if (includesAny(action, ['咖啡', '茶', '休息', '喝杯', '下午茶', '加餐'])) return 'break';
  return 'flex';
}

function getAreaScore(dayArea, foodArea) {
  if (!dayArea || !foodArea) return 0;
  if (dayArea === foodArea) return 1;
  if (dayArea.includes(foodArea) || foodArea.includes(dayArea)) return 0.9;
  const dayParts = dayArea.split(/[-/]/).filter(Boolean);
  const foodParts = foodArea.split(/[-/]/).filter(Boolean);
  const hasOverlap = dayParts.some((part) => foodArea.includes(part)) || foodParts.some((part) => dayArea.includes(part));
  return hasOverlap ? 0.55 : 0;
}

function getAreaCluster(text) {
  const value = (text || '').toLowerCase();
  if (includesAny(value, ['太湖', '西山'])) return 'xishan';
  if (includesAny(value, ['金鸡湖'])) return 'jinji';
  if (includesAny(value, ['平江', '观前', '古城', '山塘', '十全', '仓街', '拙政园', '苏州博物馆', '网师园', '双塔'])) return 'oldtown';
  return 'general';
}

function getClusterPool(foodList, cluster) {
  if (cluster === 'xishan') return foodList.filter((item) => getAreaCluster(item.area) === 'xishan');
  if (cluster === 'oldtown') return foodList.filter((item) => getAreaCluster(item.area) === 'oldtown');
  if (cluster === 'jinji') return foodList.filter((item) => getAreaCluster(item.area) === 'jinji');
  return foodList;
}

function calcDuration(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function inferAreaCluster(city, item) {
  if (
    city &&
    city.id === 'sanya' &&
    typeof item?.latitude === 'number' &&
    typeof item?.longitude === 'number'
  ) {
    if (item.longitude >= 109.7) {
      return 'haitang';
    }
    if (item.longitude >= 109.58) {
      return 'yalong';
    }
    if (item.longitude >= 109.45) {
      return 'urban';
    }
  }

  const text = [
    city && city.id,
    item && item.id,
    item && item.name,
    item && item.area,
    item && item.subArea,
    item && item.routeRole
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase();

  if (text.includes('haitang') || text.includes('海棠湾') || text.includes('后海') || text.includes('蜈支洲')) {
    return 'haitang';
  }
  if (text.includes('yalong') || text.includes('亚龙湾') || text.includes('太阳湾') || text.includes('小东海')) {
    return 'yalong';
  }
  if (text.includes('luhuitou') || text.includes('鹿回头') || text.includes('大东海') || text.includes('三亚湾')) {
    return 'urban';
  }
  if (text.includes('xishan') || text.includes('太湖') || text.includes('西山')) {
    return 'xishan';
  }
  if (text.includes('jinji') || text.includes('金鸡湖')) {
    return 'jinji';
  }
  if (text.includes('pingjiang') || text.includes('观前') || text.includes('山塘') || text.includes('平江') || text.includes('十全')) {
    return 'oldtown';
  }
  return 'general';
}

function buildItem(slot, source, city, dayIndex, itemIndex) {
  const item = source || {};
  return {
    startTime: slot.startTime,
    endTime: slot.endTime,
    placeId: item.id || `${city.id}_${dayIndex}_${itemIndex}`,
    placeName: item.name || city.name,
    placeType: item.type || slot.type,
    latitude: item.latitude,
    longitude: item.longitude,
    action: slot.action,
    duration: calcDuration(slot.startTime, slot.endTime),
    reason: item.recommendReason || city.overview,
    tips: item.riskTips || city.tip,
    updatedAt: item.updatedAt || city.updatedAt,
    statusTags: item.statusTags || city.statusTags,
    area: item.area || item.subArea || '',
    areaCluster: inferAreaCluster(city, item),
    trustLevel: item.trustLevel || (item.type === 'spot' ? 'high' : 'medium'),
    sourcePlatform: item.sourcePlatform || []
  };
}

function buildCustomDayPlan(city, dayIndex, dayConfig) {
  const allPlaces = [...city.spots, ...city.foods, ...(city.hotels || [])];
  const byId = allPlaces.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const items = dayConfig.slots.map((slot, itemIndex) =>
    buildItem(slot, slot.placeId ? byId[slot.placeId] : null, city, dayIndex, itemIndex)
  );

  const selectedPlaces = dayConfig.slots.map((slot) => byId[slot.placeId]).filter(Boolean);

  return {
    dayPlan: {
      dayNumber: dayIndex + 1,
      dayTitle: dayConfig.title,
      area: dayConfig.area,
      totalDuration: dayConfig.totalDuration,
      trafficSummary: dayConfig.trafficSummary,
      items
    },
    selectedPlaces
  };
}

function buildSuzhouXishanRelaxedDay(city, dayIndex) {
  return buildCustomDayPlan(city, dayIndex, {
    title: '太湖西山岛松弛一日',
    area: '太湖-西山岛',
    totalDuration: '7-8小时',
    trafficSummary: '更适合自驾或打车串联，核心不是刷点数量，而是把环湖、吃饭、看湖和傍晚古村顺顺地走完。',
    slots: [
      { startTime: '09:00', endTime: '09:50', action: '出发 / 进岛', type: 'base' },
      { startTime: '10:00', endTime: '11:20', action: '上午主线：进岛找状态', type: 'spot', placeId: 'sz_spot_14' },
      { startTime: '11:35', endTime: '12:55', action: '午餐：先把湖鲜吃稳', type: 'food', placeId: 'sz_food_9' },
      { startTime: '13:10', endTime: '14:40', action: '环湖慢开 / 找看湖停靠点', type: 'spot', placeId: 'sz_spot_17' },
      { startTime: '14:50', endTime: '15:35', action: '下午加餐 / 看湖 / 咖啡', type: 'food', placeId: 'sz_food_10' },
      { startTime: '15:50', endTime: '16:40', action: '补一个更直接的太湖视角', type: 'spot', placeId: 'sz_spot_16' },
      { startTime: '17:00', endTime: '18:05', action: '傍晚收口：古村散步', type: 'spot', placeId: 'sz_spot_15' },
      { startTime: '18:15', endTime: '19:35', action: '晚餐：岛上收尾再返程', type: 'food', placeId: 'sz_food_11' }
    ]
  });
}

function buildSuzhouXishanHardcoreDay(city, dayIndex) {
  return buildCustomDayPlan(city, dayIndex, {
    title: '太湖西山岛高效压缩日',
    area: '太湖-西山岛',
    totalDuration: '9-10小时',
    trafficSummary: '适合想把古城和太湖都覆盖到的人，保留西山岛核心体验，但尽量压缩停留和返程空档。',
    slots: [
      { startTime: '08:10', endTime: '08:50', action: '尽早出发 / 进岛', type: 'base' },
      { startTime: '09:00', endTime: '10:00', action: '第一站：西山岛核心段', type: 'spot', placeId: 'sz_spot_14' },
      { startTime: '10:10', endTime: '11:20', action: '第二站：环湖公路精华段', type: 'spot', placeId: 'sz_spot_17' },
      { startTime: '11:35', endTime: '12:25', action: '午餐：湖鲜快收口', type: 'food', placeId: 'sz_food_9' },
      { startTime: '12:40', endTime: '13:35', action: '第三站：石公山补视野', type: 'spot', placeId: 'sz_spot_16' },
      { startTime: '13:50', endTime: '14:35', action: '第四站：明月湾古村快速走完氛围段', type: 'spot', placeId: 'sz_spot_15' },
      { startTime: '14:45', endTime: '15:20', action: '短暂停靠：咖啡 / 小吃 / 看湖', type: 'food', placeId: 'sz_food_10' },
      { startTime: '15:35', endTime: '16:15', action: '补一个机动休息位 / 调整返程', type: 'base' },
      { startTime: '16:30', endTime: '17:50', action: '晚餐：岛上收尾再返程', type: 'food', placeId: 'sz_food_11' }
    ]
  });
}

function rebalanceFoodSlots(city, dayPlans) {
  const foodById = city.foods.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const state = {
    usedFoodIds: {},
    cuisineCounts: {},
    mainMealCounts: {},
    lastMainCuisine: null
  };

  return dayPlans.map((day) => {
    const dayCuisineSet = {};
    const dayCluster = getAreaCluster(day.area);
    const totalDays = dayPlans.length;
    const isXishanDay = dayCluster === 'xishan';

    const nextItems = day.items.map((item, itemIndex) => {
      if (item.placeType !== 'food') return item;

      const slotKind = getFoodSlotKind(item.action);
      const currentFood = foodById[item.placeId];

      if (slotKind === 'break' && currentFood) {
        const currentRole = getFoodRole(currentFood);
        if (currentRole === 'drink' || currentRole === 'snack') {
          const cuisine = getCuisineType(currentFood);
          state.usedFoodIds[currentFood.id] = true;
          state.cuisineCounts[cuisine] = (state.cuisineCounts[cuisine] || 0) + 1;
          return buildItem(item, currentFood, city, day.dayNumber - 1, itemIndex);
        }
      }

      if (isMealAction(item.action) && currentFood && getFoodRole(currentFood) === 'mainMeal') {
        const cuisine = getCuisineType(currentFood);
        dayCuisineSet[cuisine] = true;
        state.lastMainCuisine = cuisine;
        state.mainMealCounts[cuisine] = (state.mainMealCounts[cuisine] || 0) + 1;
        state.usedFoodIds[currentFood.id] = true;
        state.cuisineCounts[cuisine] = (state.cuisineCounts[cuisine] || 0) + 1;
        return buildItem(item, currentFood, city, day.dayNumber - 1, itemIndex);
      }

      const rawCandidates = city.foods.filter((food) => {
        const role = getFoodRole(food);
        const foodCluster = getAreaCluster(food.area);

        if (isXishanDay && foodCluster !== 'xishan') return false;
        if (!isXishanDay && foodCluster === 'xishan') return false;

        if (slotKind === 'break') return role === 'drink' || role === 'snack';
        if (slotKind === 'dinner') return role === 'mainMeal';
        if (slotKind === 'lunch') return role === 'mainMeal' || role === 'lightMeal';
        return true;
      });

      const preferredCandidates = getClusterPool(rawCandidates, dayCluster);
      const candidates = preferredCandidates.length ? preferredCandidates : rawCandidates;
      const unusedCandidates = candidates.filter((food) => !state.usedFoodIds[food.id]);
      const finalCandidates = unusedCandidates.length ? unusedCandidates : candidates;

      const ranked = finalCandidates
        .map((food) => {
          const cuisine = getCuisineType(food);
          const role = getFoodRole(food);
          const areaScore = getAreaScore(day.area, food.area);
          const foodCluster = getAreaCluster(food.area);
          const currentMatchBonus = currentFood && currentFood.id === food.id ? 1.35 : 0;
          const unusedBonus = state.usedFoodIds[food.id] ? -0.35 : 0.35;
          const dayCuisineBonus = dayCuisineSet[cuisine] ? -0.8 : 0.45;
          const globalCuisinePenalty = (state.cuisineCounts[cuisine] || 0) * -0.22;
          const lastCuisinePenalty =
            isMealAction(item.action) && state.lastMainCuisine && state.lastMainCuisine === cuisine ? -0.7 : 0;
          const noodlePenalty =
            isMealAction(item.action) && cuisine === 'noodle' && (state.mainMealCounts.noodle || 0) >= 1 ? -2.1 : 0;
          const repeatMainCuisinePenalty =
            isMealAction(item.action) && (state.mainMealCounts[cuisine] || 0) >= 1 ? -0.95 : 0;
          const snackMealPenalty = isMealAction(item.action) && (role === 'snack' || role === 'drink') ? -10 : 0;
          const dinnerLightPenalty = slotKind === 'dinner' && role === 'lightMeal' ? -3 : 0;
          const multiDayLightMealPenalty = slotKind === 'lunch' && totalDays >= 2 && role === 'lightMeal' ? -0.85 : 0;
          const roleBonus =
            slotKind === 'break'
              ? role === 'drink'
                ? 0.95
                : 0.15
              : slotKind === 'dinner'
                ? role === 'mainMeal'
                  ? 0.95
                  : 0
                : slotKind === 'lunch'
                  ? role === 'mainMeal'
                    ? 0.7
                    : 0.15
                  : 0;
          const clusterPenalty =
            dayCluster !== 'general' && foodCluster !== 'general' && dayCluster !== foodCluster
              ? slotKind === 'break'
                ? -1.2
                : -2.2
              : 0;

          return {
            food,
            cuisine,
            score:
              (food.recommendScore || 0) * 0.4 +
              (food.freshnessScore || 0) * 0.2 +
              areaScore +
              currentMatchBonus +
              unusedBonus +
              dayCuisineBonus +
              globalCuisinePenalty +
              lastCuisinePenalty +
              noodlePenalty +
              repeatMainCuisinePenalty +
              snackMealPenalty +
              dinnerLightPenalty +
              multiDayLightMealPenalty +
              roleBonus +
              clusterPenalty
          };
        })
        .sort((a, b) => b.score - a.score);

      const chosen = ranked[0] ? ranked[0].food : currentFood;
      if (!chosen) return item;

      const cuisine = getCuisineType(chosen);
      if (isMealAction(item.action)) {
        dayCuisineSet[cuisine] = true;
        state.lastMainCuisine = cuisine;
        state.mainMealCounts[cuisine] = (state.mainMealCounts[cuisine] || 0) + 1;
      }
      state.usedFoodIds[chosen.id] = true;
      state.cuisineCounts[cuisine] = (state.cuisineCounts[cuisine] || 0) + 1;

      return buildItem(item, chosen, city, day.dayNumber - 1, itemIndex);
    });

    return {
      ...day,
      items: nextItems
    };
  });
}

function collectSelectedPlaces(city, dayPlans, fallbackPlaces) {
  const allPlaces = [...city.spots, ...city.foods, ...(city.hotels || [])];
  const byId = allPlaces.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const routePlaces = dayPlans.flatMap((day) => day.items.map((item) => byId[item.placeId]).filter(Boolean));
  const merged = [...routePlaces, ...(fallbackPlaces || [])];
  return merged.filter((item, index) => item && merged.findIndex((current) => current.id === item.id) === index);
}

function buildTimeSlots(mode) {
  if (mode === 'hardcore') {
    return [
      { startTime: '08:30', endTime: '09:10', action: '出发 + 早餐', type: 'base' },
      { startTime: '09:20', endTime: '10:40', action: '第一景点游玩', type: 'spot' },
      { startTime: '10:55', endTime: '12:00', action: '第二景点游玩', type: 'spot' },
      { startTime: '12:10', endTime: '13:00', action: '午餐', type: 'food' },
      { startTime: '13:20', endTime: '14:30', action: '第三景点游玩', type: 'spot' },
      { startTime: '14:45', endTime: '15:45', action: '第四景点游玩', type: 'spot' },
      { startTime: '16:00', endTime: '17:00', action: '第五景点游玩', type: 'spot' },
      { startTime: '17:20', endTime: '18:20', action: '晚餐', type: 'food' },
      { startTime: '18:50', endTime: '20:10', action: '夜景/收尾', type: 'spot' }
    ];
  }

  return [
    { startTime: '09:30', endTime: '10:10', action: '出发 + 慢慢吃早餐', type: 'base' },
    { startTime: '10:20', endTime: '12:00', action: '上午主行程', type: 'spot' },
    { startTime: '12:10', endTime: '13:30', action: '午餐', type: 'food' },
    { startTime: '13:50', endTime: '15:20', action: '下午主行程', type: 'spot' },
    { startTime: '15:30', endTime: '16:20', action: '下午加餐 / 咖啡 / 甜品', type: 'base' },
    { startTime: '16:40', endTime: '18:00', action: '傍晚散步 / 补充点', type: 'spot' },
    { startTime: '18:10', endTime: '19:40', action: '晚餐', type: 'food' },
    { startTime: '20:00', endTime: '21:00', action: '夜景 / 收尾', type: 'spot' }
  ];
}

function buildGenericRoute(city, input) {
  const selectedSpotCount = input.mode === 'hardcore' ? 5 : 3;
  const selectedFoodCount = input.mode === 'hardcore' ? 2 : 1;
  const spotDemandPerDay = input.mode === 'hardcore' ? 6 : 4;
  const foodDemandPerDay = 2;

  const spots = sortPlaces(city.spots, input.preferences, input.mode).slice(
    0,
    Math.min(city.spots.length, Math.max(selectedSpotCount, input.days * spotDemandPerDay))
  );
  const foods = sortPlaces(city.foods, input.preferences, input.mode).slice(
    0,
    Math.min(city.foods.length, Math.max(selectedFoodCount, input.days * foodDemandPerDay))
  );

  const usedSpotIds = {};
  const usedFoodIds = {};
  let spotCursor = 0;
  let foodCursor = 0;

  const dayPlans = Array.from({ length: input.days }, (_, dayIndex) => {
    const slots = buildTimeSlots(input.mode);
    const items = slots.map((slot, itemIndex) => {
      let source = null;
      if (slot.type === 'spot') {
        source = spots.find((item) => !usedSpotIds[item.id]) || spots[spotCursor % spots.length];
        if (source) {
          usedSpotIds[source.id] = true;
          spotCursor += 1;
        }
      } else if (slot.type === 'food') {
        source = foods.find((item) => !usedFoodIds[item.id]) || foods[foodCursor % foods.length];
        if (source) {
          usedFoodIds[source.id] = true;
          foodCursor += 1;
        }
      }
      return buildItem(slot, source, city, dayIndex, itemIndex);
    });

    return {
      dayNumber: dayIndex + 1,
      dayTitle: city.dayTitles[dayIndex % city.dayTitles.length],
      area: city.areas[dayIndex % city.areas.length],
      totalDuration: input.mode === 'hardcore' ? '9-10小时' : '6-8小时',
      trafficSummary: input.mode === 'hardcore' ? '高效串联，少量转场' : '节奏松弛，尽量顺路',
      items
    };
  });

  const balancedDayPlans = rebalanceFoodSlots(city, dayPlans);
  return {
    dayPlans: balancedDayPlans,
    selectedPlaces: collectSelectedPlaces(city, balancedDayPlans, [...spots, ...foods])
  };
}

function buildSuzhouRelaxedRoute(city, input) {
  const allPlaces = [...city.spots, ...city.foods];
  const byId = allPlaces.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const templates = {
    1: [
      {
        title: '苏州经典初见',
        area: '拙政园-苏州博物馆-平江路',
        trafficSummary: '上午集中在园林片区，下午转入古城慢逛。',
        ids: ['sz_spot_1', 'sz_food_oldtown_taita', 'sz_spot_2', 'sz_food_6', 'sz_spot_3', 'sz_food_oldtown_huiyue', 'sz_spot_4']
      }
    ],
    2: [
      {
        title: '园林与古城打开方式',
        area: '拙政园-苏州博物馆-平江路',
        trafficSummary: '先把最稳定的内容看完，再留一点空间给步行和吃饭。',
        ids: ['sz_spot_1', 'sz_food_oldtown_taita', 'sz_spot_2', 'sz_food_6', 'sz_spot_3', 'sz_food_oldtown_huiyue', 'sz_spot_8']
      },
      {
        title: '更松弛的第二天',
        area: '网师园-十全街-金鸡湖',
        trafficSummary: '少一点硬景点，多一点生活感和夜景收尾。',
        ids: ['sz_spot_oldtown_pingjiang', 'sz_food_oldtown_manjiangyu', 'sz_spot_10', 'sz_food_oldtown_blueglass', 'sz_spot_oldtown_changjia', 'sz_food_oldtown_xiuyuan_hotpot', 'sz_spot_oldtown_guanqian']
      }
    ],
    3: [
      {
        title: '经典首访主线',
        area: '拙政园-苏州博物馆-平江路',
        trafficSummary: '先把第一梯队内容走完，避免后面取舍困难。',
        ids: ['sz_spot_1', 'sz_food_oldtown_taita', 'sz_spot_2', 'sz_food_6', 'sz_spot_3', 'sz_food_oldtown_huiyue', 'sz_spot_4']
      },
      {
        title: '古城进阶慢逛',
        area: '网师园-十全街-古城南线',
        trafficSummary: '更偏生活感和补给位，节奏明显放慢。',
        ids: ['sz_spot_oldtown_pingjiang', 'sz_food_oldtown_manjiangyu', 'sz_spot_10', 'sz_food_oldtown_blueglass', 'sz_spot_oldtown_changjia', 'sz_food_oldtown_xiuyuan_hotpot', 'sz_spot_oldtown_guanqian']
      },
      {
        title: '太湖西山岛松弛一日',
        area: '太湖-西山岛',
        trafficSummary: '把太湖线单独拿出来，做成更完整的一天。',
        ids: ['sz_spot_14', 'sz_food_9', 'sz_spot_17', 'sz_food_10', 'sz_spot_16', 'sz_food_11', 'sz_spot_15']
      }
    ]
  };

  const activeTemplates = templates[Math.min(input.days, 3)];
  const dayTemplates =
    input.days <= 3
      ? activeTemplates
      : [
          ...templates[3],
          ...Array.from({ length: input.days - 3 }, (_, index) => ({
            title: `苏州机动慢逛 Day ${index + 4}`,
            area: '古城补充线',
            trafficSummary: '用于查漏补缺，把还没去到的备选点位快速补上。',
            ids: ['sz_spot_8', 'sz_food_oldtown_taita', 'sz_spot_10', 'sz_food_oldtown_zhaoji', 'sz_spot_11', 'sz_food_oldtown_jujiang', 'sz_spot_6']
          }))
        ];

  const slots = buildTimeSlots('relaxed');
  const selectedIds = [];

  const dayPlans = dayTemplates.slice(0, input.days).map((template, dayIndex) => {
    const ids = [null, ...template.ids];
    const items = slots.map((slot, itemIndex) => {
      const source = ids[itemIndex] ? byId[ids[itemIndex]] : null;
      if (source) selectedIds.push(source.id);
      return buildItem(slot, source, city, dayIndex, itemIndex);
    });

    return {
      dayNumber: dayIndex + 1,
      dayTitle: template.title,
      area: template.area,
      totalDuration: '6-8小时',
      trafficSummary: template.trafficSummary,
      items
    };
  });

  const selectedPlaces = selectedIds
    .filter((id, index) => selectedIds.indexOf(id) === index)
    .map((id) => byId[id])
    .filter(Boolean);

  if (input.days >= 3 && dayPlans[2]) {
    const xishanDay = buildSuzhouXishanRelaxedDay(city, 2);
    dayPlans[2] = xishanDay.dayPlan;
    xishanDay.selectedPlaces.forEach((item) => {
      if (item && !selectedPlaces.find((current) => current.id === item.id)) {
        selectedPlaces.push(item);
      }
    });
  }

  const balancedDayPlans = rebalanceFoodSlots(city, dayPlans);
  return {
    dayPlans: balancedDayPlans,
    selectedPlaces: collectSelectedPlaces(city, balancedDayPlans, selectedPlaces)
  };
}

function buildSuzhouHardcoreRoute(city, input) {
  const allPlaces = [...city.spots, ...city.foods];
  const byId = allPlaces.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const templates = {
    1: [
      {
        title: '苏州高效首刷',
        area: '拙政园-苏州博物馆-平江路-山塘街',
        trafficSummary: '集中覆盖最经典的内容，尽量缩短转场等待。',
        ids: ['sz_spot_1', 'sz_spot_2', 'sz_food_oldtown_taita', 'sz_spot_3', 'sz_spot_8', 'sz_spot_4', 'sz_food_oldtown_huiyue', 'sz_spot_6']
      }
    ],
    2: [
      {
        title: '经典地标压缩日',
        area: '拙政园-苏州博物馆-平江路',
        trafficSummary: '第一天优先覆盖最不容错过的城市核心。',
        ids: ['sz_spot_1', 'sz_spot_2', 'sz_food_oldtown_taita', 'sz_spot_3', 'sz_spot_8', 'sz_spot_10', 'sz_food_oldtown_huiyue', 'sz_spot_4']
      },
      {
        title: '园林补充与古城压缩',
        area: '虎丘-狮子林-网师园',
        trafficSummary: '补差异化园林和夜间收尾，保持高效率。',
        ids: ['sz_spot_5', 'sz_spot_7', 'sz_food_oldtown_manjiangyu', 'sz_spot_9', 'sz_spot_11', 'sz_spot_12', 'sz_food_oldtown_xiuyuan_hotpot', 'sz_spot_6']
      }
    ],
    3: [
      {
        title: '首访高效主线',
        area: '拙政园-苏州博物馆-平江路',
        trafficSummary: '先把最稳定的部分走完，后续留给差异化和收口。',
        ids: ['sz_spot_1', 'sz_spot_2', 'sz_food_oldtown_taita', 'sz_spot_3', 'sz_spot_8', 'sz_spot_10', 'sz_food_oldtown_huiyue', 'sz_spot_4']
      },
      {
        title: '园林补充与古城压缩',
        area: '虎丘-狮子林-网师园',
        trafficSummary: '继续补园林和历史感，尽量减少空档。',
        ids: ['sz_spot_5', 'sz_spot_7', 'sz_food_oldtown_manjiangyu', 'sz_spot_9', 'sz_spot_11', 'sz_spot_12', 'sz_food_oldtown_xiuyuan_hotpot', 'sz_spot_6']
      },
      {
        title: '太湖西山岛高效压缩日',
        area: '太湖-西山岛',
        trafficSummary: '把西山岛单独做成高效一日，保证太湖线不被挤压掉。',
        ids: ['sz_spot_14', 'sz_spot_17', 'sz_food_9', 'sz_spot_16', 'sz_spot_15', 'sz_spot_17', 'sz_food_11', 'sz_spot_15']
      }
    ]
  };

  const activeTemplates = templates[Math.min(input.days, 3)];
  const dayTemplates =
    input.days <= 3
      ? activeTemplates
      : [
          ...templates[3],
          ...Array.from({ length: input.days - 3 }, (_, index) => ({
            title: `苏州特种机动 Day ${index + 4}`,
            area: '古城补充线',
            trafficSummary: '用于查漏补缺，把还没去到的备选点位快速覆盖。',
            ids: ['sz_spot_9', 'sz_spot_11', 'sz_food_oldtown_taita', 'sz_spot_12', 'sz_spot_10', 'sz_spot_8', 'sz_food_oldtown_jujiang', 'sz_spot_6']
          }))
        ];

  const slots = buildTimeSlots('hardcore');
  const selectedIds = [];

  const dayPlans = dayTemplates.slice(0, input.days).map((template, dayIndex) => {
    const ids = [null, ...template.ids];
    const items = slots.map((slot, itemIndex) => {
      const source = ids[itemIndex] ? byId[ids[itemIndex]] : null;
      if (source) selectedIds.push(source.id);
      return buildItem(slot, source, city, dayIndex, itemIndex);
    });

    return {
      dayNumber: dayIndex + 1,
      dayTitle: template.title,
      area: template.area,
      totalDuration: '9-10小时',
      trafficSummary: template.trafficSummary,
      items
    };
  });

  const selectedPlaces = selectedIds
    .filter((id, index) => selectedIds.indexOf(id) === index)
    .map((id) => byId[id])
    .filter(Boolean);

  if (input.days >= 3 && dayPlans[2]) {
    const xishanDay = buildSuzhouXishanHardcoreDay(city, 2);
    dayPlans[2] = xishanDay.dayPlan;
    xishanDay.selectedPlaces.forEach((item) => {
      if (item && !selectedPlaces.find((current) => current.id === item.id)) {
        selectedPlaces.push(item);
      }
    });
  }

  const balancedDayPlans = rebalanceFoodSlots(city, dayPlans);
  return {
    dayPlans: balancedDayPlans,
    selectedPlaces: collectSelectedPlaces(city, balancedDayPlans, selectedPlaces)
  };
}

function buildCustomRouteFromConfigs(city, configs) {
  const selectedPlaces = [];
  const dayPlans = configs.map((config, dayIndex) => {
    const built = buildCustomDayPlan(city, dayIndex, config);
    built.selectedPlaces.forEach((item) => {
      if (item && !selectedPlaces.find((current) => current.id === item.id)) {
        selectedPlaces.push(item);
      }
    });
    return built.dayPlan;
  });

  const balancedDayPlans = rebalanceFoodSlots(city, dayPlans);
  return {
    dayPlans: balancedDayPlans,
    selectedPlaces: collectSelectedPlaces(city, balancedDayPlans, selectedPlaces)
  };
}

function buildHainanRelaxedRoute(city, input) {
  const configsByDay = {
    1: [
      {
        title: '海棠湾松弛首日',
        area: '三亚海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '用海棠湾和后海先把海南的度假感建立起来，不急着跨区。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发 / 进入海边节奏', type: 'base' },
          { startTime: '10:20', endTime: '12:10', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:35', action: '午餐：海棠湾稳妥正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:10', action: '下午主线：蜈支洲岛海岛体验段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:30', endTime: '16:10', action: '海边补给：咖啡休息', type: 'food', placeId: 'hn_food_11' },
          { startTime: '16:25', endTime: '17:25', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：糟粕醋正餐位', type: 'food', placeId: 'hn_food_4' }
        ]
      }
    ],
    2: [
      {
        title: '海棠湾与后海松弛线',
        area: '三亚海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '第一天优先建立海边度假感，避免上来就把路线做碎。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发 / 留足酒店节奏', type: 'base' },
          { startTime: '10:20', endTime: '12:05', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:35', action: '午餐：海棠湾稳妥正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:20', action: '下午主线：蜈支洲岛或玩水段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:40', endTime: '16:15', action: '补给：椰子甜品缓冲高温', type: 'food', placeId: 'hn_food_13' },
          { startTime: '16:35', endTime: '17:25', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：差异化糟粕醋正餐', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '三亚市区与日落收尾',
        area: '三亚亚龙湾-市区',
        totalDuration: '7-8小时',
        trafficSummary: '第二天切到市区和傍晚海边，把观景、散步和正餐串完整。',
        slots: [
          { startTime: '09:50', endTime: '10:20', action: '从酒店出发 / 向亚龙湾方向推进', type: 'base' },
          { startTime: '10:35', endTime: '11:20', action: '上午补位：沿海公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '11:40', endTime: '12:50', action: '午餐：更生活化的家常热炒', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:20', endTime: '14:35', action: '下午主线：小东海轻松海边段', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:50', endTime: '15:15', action: '下午补给：清补凉降温', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:10', endTime: '17:30', action: '傍晚主线：鹿回头看城市海景', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:50', endTime: '19:15', action: '晚餐：正式留一顿海南私房菜', type: 'food', placeId: 'hn_food_1' }
        ]
      }
    ],
    3: [
      {
        title: '海棠湾度假主线',
        area: '三亚海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '先把最像度假的海棠湾线走稳，不急着跨区。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发 / 保留松弛感', type: 'base' },
          { startTime: '10:20', endTime: '12:00', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:30', action: '午餐：海棠湾稳妥正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:15', action: '下午主线：蜈支洲岛或玩水段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:35', endTime: '16:10', action: '海边补给：咖啡停靠', type: 'food', placeId: 'hn_food_11' },
          { startTime: '16:30', endTime: '17:20', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：糟粕醋正餐位', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '三亚市区与日落海边',
        area: '三亚亚龙湾-市区',
        totalDuration: '7-8小时',
        trafficSummary: '这一天把市区和傍晚海边组合起来，保持节奏起伏。',
        slots: [
          { startTime: '09:40', endTime: '10:10', action: '从酒店出发 / 切入亚龙湾方向', type: 'base' },
          { startTime: '10:25', endTime: '11:10', action: '上午补位：太阳湾观景公路', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '11:30', endTime: '12:40', action: '午餐：轻一点但不敷衍的鸡饭', type: 'food', placeId: 'hn_food_5' },
          { startTime: '13:10', endTime: '14:35', action: '下午主线：小东海轻海边线', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:50', endTime: '15:15', action: '下午补给：清补凉休息', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:00', endTime: '17:20', action: '傍晚主线：鹿回头看日落和城市海景', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:45', endTime: '19:10', action: '晚餐：海南私房菜正餐', type: 'food', placeId: 'hn_food_1' }
        ]
      },
      {
        title: '陵水清水湾外扩日',
        area: '陵水清水湾-分界洲',
        totalDuration: '8-9小时',
        trafficSummary: '第三天单独留给陵水，不把它和三亚强行拼在一起。',
        slots: [
          { startTime: '08:45', endTime: '09:30', action: '出发前往陵水 / 预留跨区交通', type: 'base' },
          { startTime: '10:00', endTime: '12:00', action: '上午主线：分界洲岛完整段', type: 'spot', placeId: 'hn_spot_9' },
          { startTime: '12:20', endTime: '13:00', action: '午间补给：先用本地小吃垫一口', type: 'food', placeId: 'hn_food_6' },
          { startTime: '13:30', endTime: '14:40', action: '下午主线：清水湾灯塔海边线', type: 'spot', placeId: 'hn_spot_10' },
          { startTime: '15:00', endTime: '15:30', action: '下午补给：海边发呆时间', type: 'food', placeId: 'hn_food_12' },
          { startTime: '16:10', endTime: '17:10', action: '傍晚自由留给清水湾海边散步', type: 'base' },
          { startTime: '17:40', endTime: '19:00', action: '晚餐：陵水区域内闭环正餐', type: 'food', placeId: 'hn_food_7' }
        ]
      }
    ],
    4: [
      {
        title: '海棠湾度假主线',
        area: '三亚海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '先用一天把海棠湾的度假主线走舒服。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发', type: 'base' },
          { startTime: '10:20', endTime: '12:00', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:30', action: '午餐：椰子鸡正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:20', action: '下午主线：海岛玩水段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:40', endTime: '16:15', action: '海边补给：咖啡休息', type: 'food', placeId: 'hn_food_11' },
          { startTime: '16:35', endTime: '17:25', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：糟粕醋正餐', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '三亚市区海景线',
        area: '三亚亚龙湾-市区',
        totalDuration: '7-8小时',
        trafficSummary: '第二天回到市区与日落线，避免连续两天都只在同一种海边节奏里。',
        slots: [
          { startTime: '09:40', endTime: '10:10', action: '出发切入亚龙湾方向', type: 'base' },
          { startTime: '10:25', endTime: '11:10', action: '上午补位：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '11:30', endTime: '12:40', action: '午餐：家常热炒正餐', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:10', endTime: '14:40', action: '下午主线：小东海海边轻体验', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:55', endTime: '15:20', action: '下午补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:10', endTime: '17:20', action: '傍晚主线：鹿回头城市海景', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:45', endTime: '19:15', action: '晚餐：海南私房菜', type: 'food', placeId: 'hn_food_1' }
        ]
      },
      {
        title: '陵水清水湾外扩日',
        area: '陵水清水湾-分界洲',
        totalDuration: '8-9小时',
        trafficSummary: '第三天单独给陵水，住一晚会明显更舒服。',
        slots: [
          { startTime: '08:40', endTime: '09:25', action: '从三亚出发前往陵水', type: 'base' },
          { startTime: '10:00', endTime: '12:00', action: '上午主线：分界洲岛完整段', type: 'spot', placeId: 'hn_spot_9' },
          { startTime: '12:20', endTime: '13:00', action: '午间补给：陵水酸粉轻餐', type: 'food', placeId: 'hn_food_6' },
          { startTime: '13:30', endTime: '14:40', action: '下午主线：清水湾灯塔海边线', type: 'spot', placeId: 'hn_spot_10' },
          { startTime: '15:00', endTime: '15:30', action: '下午补给：海边咖啡休息', type: 'food', placeId: 'hn_food_12' },
          { startTime: '16:10', endTime: '17:10', action: '傍晚自由留给清水湾海边散步', type: 'base' },
          { startTime: '17:40', endTime: '19:00', action: '晚餐：陵水区域正餐', type: 'food', placeId: 'hn_food_7' }
        ]
      },
      {
        title: '万宁海岸线进阶日',
        area: '万宁石梅湾-日月湾',
        totalDuration: '8-9小时',
        trafficSummary: '最后一天把万宁做成完整海岸公路线，而不是远距离一闪而过。',
        slots: [
          { startTime: '08:30', endTime: '09:30', action: '出发前往万宁 / 预留外扩交通', type: 'base' },
          { startTime: '10:10', endTime: '10:55', action: '上午第一站：石梅湾观海亭', type: 'spot', placeId: 'hn_spot_11' },
          { startTime: '11:20', endTime: '12:30', action: '午餐：万宁区域正餐', type: 'food', placeId: 'hn_food_9' },
          { startTime: '13:00', endTime: '14:30', action: '下午主线：日月湾年轻海边线', type: 'spot', placeId: 'hn_spot_12' },
          { startTime: '14:50', endTime: '15:25', action: '下午补给：海边咖啡缓冲', type: 'food', placeId: 'hn_food_12' },
          { startTime: '15:50', endTime: '16:35', action: '沿海公路自由停靠 / 海景留白', type: 'base' },
          { startTime: '17:10', endTime: '18:40', action: '晚餐：带一点氛围感的海边餐酒馆', type: 'food', placeId: 'hn_food_8' }
        ]
      }
    ]
  };

  const configs =
    input.days <= 4
      ? configsByDay[Math.min(input.days, 4)]
      : [
          ...configsByDay[4],
          ...Array.from({ length: input.days - 4 }, (_, index) => ({
            title: `海南机动松弛 Day ${index + 5}`,
            area: '三亚亚龙湾-市区',
            totalDuration: '6-7小时',
            trafficSummary: '用于补回酒店度假、海边散步和遗漏的市区餐厅，不再硬塞跨区外扩。',
            slots: [
              { startTime: '10:00', endTime: '10:30', action: '机动慢出发 / 调整节奏', type: 'base' },
              { startTime: '10:45', endTime: '11:45', action: '上午补位：椰梦长廊散步', type: 'spot', placeId: 'hn_spot_5' },
              { startTime: '12:00', endTime: '13:10', action: '午餐：家常热炒正餐', type: 'food', placeId: 'hn_food_14' },
              { startTime: '13:40', endTime: '14:50', action: '下午主线：亚龙湾森林公园半日线', type: 'spot', placeId: 'hn_spot_8' },
              { startTime: '15:10', endTime: '15:35', action: '下午补给：清补凉', type: 'food', placeId: 'hn_food_10' },
              { startTime: '16:10', endTime: '17:00', action: '傍晚海边散步补位', type: 'spot', placeId: 'hn_spot_5' },
              { startTime: '17:30', endTime: '18:50', action: '晚餐：海鲜正餐收口', type: 'food', placeId: 'hn_food_2' }
            ]
          }))
        ];

  return buildCustomRouteFromConfigs(city, configs.slice(0, input.days));
}

function buildHainanHardcoreRoute(city, input) {
  const configsByDay = {
    1: [
      {
        title: '三亚高效首刷日',
        area: '三亚海棠湾-后海 / 三亚亚龙湾-市区',
        totalDuration: '9-10小时',
        trafficSummary: '把海棠湾、市区和日落线压进同一天，适合时间紧的人。',
        slots: [
          { startTime: '08:20', endTime: '08:50', action: '尽早出发 / 切入海棠湾', type: 'base' },
          { startTime: '09:10', endTime: '10:20', action: '第一站：后海村快速建立海边印象', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '10:40', endTime: '11:50', action: '第二站：蜈支洲岛压缩体验段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '12:10', endTime: '13:05', action: '午餐：轻一点的鸡饭正餐', type: 'food', placeId: 'hn_food_5' },
          { startTime: '13:35', endTime: '14:10', action: '第三站：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '14:30', endTime: '15:20', action: '第四站：小东海快速停留', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '15:35', endTime: '16:00', action: '补给：清补凉快速缓冲', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:30', endTime: '17:40', action: '傍晚主线：鹿回头看城市海景', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '18:00', endTime: '19:20', action: '晚餐：海南私房菜正餐', type: 'food', placeId: 'hn_food_1' }
        ]
      }
    ],
    2: [
      {
        title: '海棠湾压缩主线',
        area: '三亚海棠湾-后海',
        totalDuration: '9-10小时',
        trafficSummary: '第一天优先高效覆盖海棠湾和后海，不浪费时间在反复折返上。',
        slots: [
          { startTime: '08:30', endTime: '09:00', action: '尽早出发', type: 'base' },
          { startTime: '09:20', endTime: '10:30', action: '第一站：后海村', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '10:50', endTime: '12:05', action: '第二站：蜈支洲岛压缩体验', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '12:20', endTime: '13:10', action: '午餐：海棠湾正餐快收口', type: 'food', placeId: 'hn_food_3' },
          { startTime: '13:35', endTime: '14:10', action: '第三站：海边自由停留', type: 'base' },
          { startTime: '14:30', endTime: '15:00', action: '补给：咖啡或甜品', type: 'food', placeId: 'hn_food_13' },
          { startTime: '15:30', endTime: '16:15', action: '第四站：酒店或近海自由活动', type: 'base' },
          { startTime: '16:40', endTime: '18:00', action: '晚餐：糟粕醋差异化正餐', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '三亚市区压缩日',
        area: '三亚亚龙湾-市区',
        totalDuration: '9-10小时',
        trafficSummary: '第二天把公路观景、市区海边和日落线集中完成。',
        slots: [
          { startTime: '08:45', endTime: '09:10', action: '出发切向亚龙湾', type: 'base' },
          { startTime: '09:30', endTime: '10:10', action: '第一站：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '10:35', endTime: '11:45', action: '第二站：亚龙湾森林公园半日段', type: 'spot', placeId: 'hn_spot_8' },
          { startTime: '12:05', endTime: '13:00', action: '午餐：家常热炒快收口', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:25', endTime: '14:15', action: '第三站：小东海', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:30', endTime: '15:10', action: '第四站：椰梦长廊快速散步', type: 'spot', placeId: 'hn_spot_5' },
          { startTime: '15:25', endTime: '15:50', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:20', endTime: '17:25', action: '第五站：鹿回头收尾', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:50', endTime: '19:15', action: '晚餐：正式海鲜餐位', type: 'food', placeId: 'hn_food_2' }
        ]
      }
    ],
    3: [
      {
        title: '三亚首访高效主线',
        area: '三亚海棠湾-后海 / 三亚亚龙湾-市区',
        totalDuration: '9-10小时',
        trafficSummary: '第一天把三亚最不该错过的部分压缩串联。',
        slots: [
          { startTime: '08:20', endTime: '08:50', action: '尽早出发', type: 'base' },
          { startTime: '09:10', endTime: '10:15', action: '第一站：后海村', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '10:35', endTime: '11:45', action: '第二站：蜈支洲岛压缩体验', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '12:05', endTime: '13:00', action: '午餐：海南鸡饭轻正餐', type: 'food', placeId: 'hn_food_5' },
          { startTime: '13:30', endTime: '14:05', action: '第三站：太阳湾观景公路', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '14:30', endTime: '15:20', action: '第四站：小东海', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '15:35', endTime: '16:00', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:30', endTime: '17:35', action: '第五站：鹿回头', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '18:00', endTime: '19:20', action: '晚餐：海南私房菜', type: 'food', placeId: 'hn_food_1' }
        ]
      },
      {
        title: '三亚补强与海边压缩日',
        area: '三亚亚龙湾-市区',
        totalDuration: '9-10小时',
        trafficSummary: '第二天补足亚龙湾和市区海边，尽量不重复前一天主景点。',
        slots: [
          { startTime: '08:45', endTime: '09:10', action: '出发', type: 'base' },
          { startTime: '09:30', endTime: '10:40', action: '第一站：亚龙湾森林公园', type: 'spot', placeId: 'hn_spot_8' },
          { startTime: '11:05', endTime: '12:00', action: '第二站：椰梦长廊补一个城市海边段', type: 'spot', placeId: 'hn_spot_5' },
          { startTime: '12:20', endTime: '13:10', action: '午餐：家常热炒', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:35', endTime: '15:20', action: '第三站：西岛压缩体验段', type: 'spot', placeId: 'hn_spot_7' },
          { startTime: '15:40', endTime: '16:05', action: '补给：冷饮快速缓冲', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:35', endTime: '17:25', action: '第四站：小东海或近海停留', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '17:50', endTime: '19:15', action: '晚餐：海鲜正餐', type: 'food', placeId: 'hn_food_2' }
        ]
      },
      {
        title: '万宁外扩高效日',
        area: '万宁石梅湾-日月湾',
        totalDuration: '10小时',
        trafficSummary: '第三天把万宁海岸线压缩成完整一日，适合想看更真实海岸线的人。',
        slots: [
          { startTime: '07:50', endTime: '09:10', action: '尽早出发前往万宁', type: 'base' },
          { startTime: '10:00', endTime: '10:40', action: '第一站：石梅湾观海亭', type: 'spot', placeId: 'hn_spot_11' },
          { startTime: '11:00', endTime: '12:20', action: '第二站：日月湾主线', type: 'spot', placeId: 'hn_spot_12' },
          { startTime: '12:35', endTime: '13:25', action: '午餐：万宁区域内正餐', type: 'food', placeId: 'hn_food_9' },
          { startTime: '13:50', endTime: '14:35', action: '第三站：沿海公路自由停靠', type: 'base' },
          { startTime: '14:55', endTime: '15:25', action: '补给：海边咖啡', type: 'food', placeId: 'hn_food_12' },
          { startTime: '15:45', endTime: '16:35', action: '第四站：海边自由停留或冲浪围观', type: 'base' },
          { startTime: '17:00', endTime: '18:25', action: '晚餐：海边餐酒馆', type: 'food', placeId: 'hn_food_8' }
        ]
      }
    ],
    4: [
      {
        title: '三亚高效首刷日',
        area: '三亚海棠湾-后海 / 三亚亚龙湾-市区',
        totalDuration: '9-10小时',
        trafficSummary: '第一天用高效方式完成三亚最核心的海边和观景线。',
        slots: [
          { startTime: '08:20', endTime: '08:50', action: '尽早出发', type: 'base' },
          { startTime: '09:10', endTime: '10:15', action: '第一站：后海村', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '10:35', endTime: '11:45', action: '第二站：蜈支洲岛压缩体验', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '12:05', endTime: '13:00', action: '午餐：海南鸡饭轻正餐', type: 'food', placeId: 'hn_food_5' },
          { startTime: '13:30', endTime: '14:05', action: '第三站：太阳湾观景公路', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '14:30', endTime: '15:20', action: '第四站：小东海', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '15:35', endTime: '16:00', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:30', endTime: '17:35', action: '第五站：鹿回头', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '18:00', endTime: '19:20', action: '晚餐：海南私房菜', type: 'food', placeId: 'hn_food_1' }
        ]
      },
      {
        title: '三亚补强压缩日',
        area: '三亚亚龙湾-市区',
        totalDuration: '9-10小时',
        trafficSummary: '第二天把没覆盖到的三亚内容集中补齐。',
        slots: [
          { startTime: '08:45', endTime: '09:10', action: '出发', type: 'base' },
          { startTime: '09:30', endTime: '10:40', action: '第一站：亚龙湾森林公园', type: 'spot', placeId: 'hn_spot_8' },
          { startTime: '11:05', endTime: '12:00', action: '第二站：椰梦长廊', type: 'spot', placeId: 'hn_spot_5' },
          { startTime: '12:20', endTime: '13:10', action: '午餐：家常热炒', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:35', endTime: '15:20', action: '第三站：西岛压缩体验段', type: 'spot', placeId: 'hn_spot_7' },
          { startTime: '15:40', endTime: '16:05', action: '补给：冷饮快速缓冲', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:35', endTime: '17:25', action: '第四站：小东海补位', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '17:50', endTime: '19:15', action: '晚餐：海鲜正餐', type: 'food', placeId: 'hn_food_2' }
        ]
      },
      {
        title: '陵水高效外扩日',
        area: '陵水清水湾-分界洲',
        totalDuration: '9-10小时',
        trafficSummary: '第三天单压陵水，减少无效折返。',
        slots: [
          { startTime: '08:00', endTime: '09:00', action: '尽早前往陵水', type: 'base' },
          { startTime: '09:40', endTime: '11:30', action: '第一站：分界洲岛主线', type: 'spot', placeId: 'hn_spot_9' },
          { startTime: '11:50', endTime: '12:25', action: '午间补给：陵水酸粉', type: 'food', placeId: 'hn_food_6' },
          { startTime: '12:55', endTime: '14:00', action: '第二站：清水湾海边线', type: 'spot', placeId: 'hn_spot_10' },
          { startTime: '14:20', endTime: '14:50', action: '补给：海边咖啡', type: 'food', placeId: 'hn_food_12' },
          { startTime: '15:15', endTime: '16:05', action: '第三站：清水湾自由散步与休息', type: 'base' },
          { startTime: '16:35', endTime: '17:55', action: '晚餐：陵水区域正餐', type: 'food', placeId: 'hn_food_7' }
        ]
      },
      {
        title: '万宁海岸线高效日',
        area: '万宁石梅湾-日月湾',
        totalDuration: '10小时',
        trafficSummary: '最后一天完成万宁海岸线，不把它做成匆匆路过。',
        slots: [
          { startTime: '07:50', endTime: '09:10', action: '尽早前往万宁', type: 'base' },
          { startTime: '10:00', endTime: '10:40', action: '第一站：石梅湾观海亭', type: 'spot', placeId: 'hn_spot_11' },
          { startTime: '11:00', endTime: '12:20', action: '第二站：日月湾主线', type: 'spot', placeId: 'hn_spot_12' },
          { startTime: '12:35', endTime: '13:20', action: '午餐：万宁区域正餐', type: 'food', placeId: 'hn_food_9' },
          { startTime: '13:45', endTime: '14:30', action: '第三站：沿海公路自由停靠', type: 'base' },
          { startTime: '14:50', endTime: '15:20', action: '补给：海边咖啡', type: 'food', placeId: 'hn_food_12' },
          { startTime: '15:45', endTime: '16:30', action: '第四站：日月湾自由停留 / 看冲浪', type: 'base' },
          { startTime: '17:00', endTime: '18:25', action: '晚餐：海边餐酒馆', type: 'food', placeId: 'hn_food_8' }
        ]
      }
    ]
  };

  const configs =
    input.days <= 4
      ? configsByDay[Math.min(input.days, 4)]
      : [
          ...configsByDay[4],
          ...Array.from({ length: input.days - 4 }, (_, index) => ({
            title: `海南高效机动 Day ${index + 5}`,
            area: '三亚亚龙湾-市区',
            totalDuration: '8-9小时',
            trafficSummary: '补未覆盖点位和想二刷的海边时段，避免继续无意义拉长跨区移动。',
            slots: [
              { startTime: '09:00', endTime: '09:25', action: '机动出发', type: 'base' },
              { startTime: '09:45', endTime: '10:55', action: '上午补位：亚龙湾森林公园', type: 'spot', placeId: 'hn_spot_8' },
              { startTime: '11:20', endTime: '12:10', action: '午餐：鸡饭轻正餐', type: 'food', placeId: 'hn_food_5' },
              { startTime: '12:40', endTime: '13:35', action: '第二站：椰梦长廊或城市海边段', type: 'spot', placeId: 'hn_spot_5' },
              { startTime: '13:55', endTime: '14:20', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
              { startTime: '14:45', endTime: '15:35', action: '第三站：小东海', type: 'spot', placeId: 'hn_spot_6' },
              { startTime: '16:00', endTime: '17:20', action: '晚餐：海鲜正餐', type: 'food', placeId: 'hn_food_2' }
            ]
          }))
        ];

  return buildCustomRouteFromConfigs(city, configs.slice(0, input.days));
}

function buildStayPlan(city, input, dayPlans) {
  const hotels = (city.hotels || []).filter((item) => {
    const avgCost = item.avgCost || 0;
    const qualityPass = (item.recommendScore || 0) >= 4.3;
    const isTaihuStay = (item.area || '').includes('太湖');
    const pricePass = isTaihuStay ? avgCost >= 650 : avgCost >= 500;
    const riskPass = (item.marketingRiskScore || 0) <= (avgCost >= 850 ? 0.12 : 0.1);
    return qualityPass && riskPass && pricePass;
  });

  if (!hotels.length) return null;

  const areaText = dayPlans.map((day) => day.area || '').join(' / ');
  const includesTaihu = areaText.includes('太湖-西山岛');
  const includesSouth = areaText.includes('古城南线') || areaText.includes('十全街');

  let areaAdvice = '优先住古城中心或平江路一带，减少折返。';
  let nightStrategy = '全程住同一家酒店即可。';
  let candidateIds = ['sz_hotel_oldtown_1', 'sz_hotel_oldtown_2', 'sz_hotel_oldtown_3'];

  if (city.id === 'suzhou') {
    if (includesTaihu && input.days >= 3 && input.mode === 'relaxed') {
      areaAdvice = '前两晚优先住古城东线，最后一晚切到西山岛，路线会更完整。';
      nightStrategy = '推荐“古城 2 晚 + 西山岛 1 晚”，如果不换酒店，至少预留太湖返程时间。';
      candidateIds = ['sz_hotel_oldtown_2', 'sz_hotel_xishan_10', 'sz_hotel_xishan_7', 'sz_hotel_xishan_3', 'sz_hotel_xishan_8', 'sz_hotel_xishan_5', 'sz_hotel_xishan_6', 'sz_hotel_xishan_9'];
    } else if (includesTaihu) {
      areaAdvice = '如果太湖线只占一天，优先住古城中心；如果打算深玩西山岛，再考虑岛上过夜。';
      nightStrategy = '推荐“古城连住”为主，太湖强度高时再切一晚西山岛。';
      candidateIds = ['sz_hotel_oldtown_1', 'sz_hotel_oldtown_2', 'sz_hotel_xishan_10', 'sz_hotel_xishan_7', 'sz_hotel_xishan_3', 'sz_hotel_xishan_5'];
    } else if (includesSouth) {
      areaAdvice = '十全街和古城南线占比高时，住南线或平江路一带会更顺。';
      nightStrategy = '建议全程住古城，不必频繁换酒店。';
      candidateIds = ['sz_hotel_oldtown_3', 'sz_hotel_oldtown_2', 'sz_hotel_oldtown_1'];
    } else if (input.mode === 'hardcore') {
      areaAdvice = '高效路线优先住古城中心，出发和回程都更省时间。';
      nightStrategy = '建议全程住同一家古城酒店。';
      candidateIds = ['sz_hotel_oldtown_1', 'sz_hotel_oldtown_2', 'sz_hotel_oldtown_3'];
    } else {
      areaAdvice = '松弛古城线更适合住平江路或观前街附近，步行体验更完整。';
      nightStrategy = '建议全程住古城东线或古城中心。';
      candidateIds = ['sz_hotel_oldtown_2', 'sz_hotel_oldtown_1', 'sz_hotel_oldtown_3'];
    }
  }

  const items = candidateIds
    .map((id) => hotels.find((item) => item.id === id))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      name: item.name,
      area: item.area,
      decision: item.decision,
      nightlyPriceRange: item.nightlyPriceRange,
      stayStyle: item.stayStyle,
      routeRole: item.routeRole,
      sourcePlatform: item.sourcePlatform,
      qualityLabel: (item.avgCost || 0) >= 800 ? '高品质度假型' : '中高品质稳定型'
    }));

  if (!items.length) return null;

  return {
    title: '住宿建议',
    summary: areaAdvice,
    nightStrategy,
    items
  };
}

function attachStayToDayPlans(city, input, dayPlans, stayPlan, selectedPlaces) {
  if (!stayPlan || !stayPlan.items || !stayPlan.items.length) {
    return { dayPlans, selectedPlaces, stayPlan };
  }

  const hotelById = (city.hotels || []).reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  let nightlyHotelIds = Array.from({ length: dayPlans.length }, () => stayPlan.items[0].id);

  if (city.id === 'suzhou') {
    const hasTaihuDay = dayPlans.some((day) => (day.area || '').includes('太湖-西山岛'));
    if (hasTaihuDay && input.days >= 3 && input.mode === 'relaxed') {
      nightlyHotelIds = dayPlans.map((day) => {
        if ((day.area || '').includes('太湖-西山岛')) {
          return stayPlan.items.find((item) => item.id !== 'sz_hotel_oldtown_2')?.id || stayPlan.items[0].id;
        }
        return 'sz_hotel_oldtown_2';
      });
    } else if (input.mode === 'hardcore') {
      nightlyHotelIds = dayPlans.map(() => stayPlan.items[0].id);
    } else if (stayPlan.items[1] && (dayPlans[dayPlans.length - 1].area || '').includes('太湖-西山岛')) {
      nightlyHotelIds = dayPlans.map((day) =>
        (day.area || '').includes('太湖-西山岛') ? stayPlan.items[1].id : stayPlan.items[0].id
      );
    }
  }

  const nextDayPlans = dayPlans.map((day, dayIndex) => {
    const hotel = hotelById[nightlyHotelIds[dayIndex]];
    if (!hotel) return day;

    const stayItem = {
      startTime: day.items[day.items.length - 1]?.endTime || '20:30',
      endTime: '23:59',
      placeId: hotel.id,
      placeName: hotel.name,
      placeType: 'hotel',
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      action: dayIndex === dayPlans.length - 1 ? '回到住宿 / 收尾休息' : '入住 / 放行李 / 夜间休息',
      duration: 0,
      reason: hotel.recommendReason || hotel.summary,
      tips: hotel.riskTips || city.tip,
      updatedAt: hotel.updatedAt || city.updatedAt,
      statusTags: hotel.statusTags || city.statusTags,
      area: hotel.area || hotel.subArea || '',
      areaCluster: inferAreaCluster(city, hotel),
      trustLevel: hotel.trustLevel || 'high',
      sourcePlatform: hotel.sourcePlatform || []
    };

    const previousHotelId = dayIndex > 0 ? nightlyHotelIds[dayIndex - 1] : null;
    const isSwitchNight = !!previousHotelId && previousHotelId !== hotel.id;
    const stayTransition =
      dayIndex === 0
        ? `第 1 晚入住 ${hotel.name}`
        : isSwitchNight
          ? `第 ${day.dayNumber} 晚换住 ${hotel.name}`
          : `第 ${day.dayNumber} 晚继续住 ${hotel.name}`;

    return {
      ...day,
      stayMeta: {
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelArea: hotel.area,
        isSwitchNight,
        stayTransition
      },
      items: [...day.items, stayItem]
    };
  });

  const hotelItems = nightlyHotelIds
    .map((id) => hotelById[id])
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((target) => target.id === item.id) === index);

  hotelItems.forEach((item) => {
    if (!selectedPlaces.find((current) => current.id === item.id)) {
      selectedPlaces.push(item);
    }
  });

  const nextStayPlan = {
    ...stayPlan,
    assignments: nextDayPlans.map((day, index) => ({
      dayNumber: day.dayNumber,
      dayTitle: day.dayTitle,
      hotelId: nightlyHotelIds[index],
      hotelName: hotelById[nightlyHotelIds[index]]?.name || '',
      area: hotelById[nightlyHotelIds[index]]?.area || '',
      isSwitchNight: !!(index > 0 && nightlyHotelIds[index - 1] !== nightlyHotelIds[index]),
      transitionText:
        index === 0
          ? `第 1 晚入住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
          : nightlyHotelIds[index - 1] !== nightlyHotelIds[index]
            ? `第 ${index + 1} 晚换住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
            : `第 ${index + 1} 晚继续住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
    }))
  };

  return {
    dayPlans: nextDayPlans,
    selectedPlaces,
    stayPlan: nextStayPlan
  };
}

function buildEnhancedStayPlan(city, input, dayPlans) {
  if (city.id !== 'hainan') {
    return buildStayPlan(city, input, dayPlans);
  }

  const hotels = (city.hotels || []).filter((item) => {
    const avgCost = item.avgCost || 0;
    const qualityPass = (item.recommendScore || 0) >= 4.3;
    const riskPass = (item.marketingRiskScore || 0) <= (avgCost >= 850 ? 0.12 : 0.1);
    return qualityPass && riskPass && avgCost >= 760;
  });

  if (!hotels.length) return null;

  const areaText = dayPlans.map((day) => day.area || '').join(' / ');
  const includesLingshui = areaText.includes('陵水清水湾-分界洲');
  const includesWanning = areaText.includes('万宁石梅湾-日月湾');
  const includesHaitang = areaText.includes('三亚海棠湾-后海');

  let summary = '路线重心偏三亚时，优先住海边交通更顺的高质量酒店，减少每天收拾和折返。';
  let nightStrategy = '建议全程住同一家三亚酒店，除非明确要做陵水或万宁过夜。';
  let candidateIds = includesHaitang ? ['hn_hotel_1', 'hn_hotel_2', 'hn_hotel_3'] : ['hn_hotel_5', 'hn_hotel_4', 'hn_hotel_3'];

  if (includesWanning && includesLingshui) {
    summary = '海南这种双外扩路线更适合分段住，先把三亚住稳，再顺着陵水和万宁切换，体感会比天天往返舒服很多。';
    nightStrategy = '推荐“三亚连住 + 陵水 1 晚 + 万宁 1 晚”。';
    candidateIds = ['hn_hotel_3', 'hn_hotel_6', 'hn_hotel_7', 'hn_hotel_8'];
  } else if (includesWanning) {
    summary = '既然已经把万宁纳入主线，最后一晚切到石梅湾或神州半岛更合理，不然外扩价值会被来回路程吃掉。';
    nightStrategy = '推荐“三亚连住 + 万宁 1 晚”。';
    candidateIds = ['hn_hotel_3', 'hn_hotel_7', 'hn_hotel_8', 'hn_hotel_5'];
  } else if (includesLingshui) {
    summary = '陵水更适合做成住一晚的外扩，不然分界洲和清水湾会明显变赶。';
    nightStrategy = '推荐“三亚连住 + 清水湾 1 晚”。';
    candidateIds = ['hn_hotel_3', 'hn_hotel_6', 'hn_hotel_5', 'hn_hotel_1'];
  } else if (includesHaitang && input.mode === 'relaxed') {
    summary = '海棠湾更适合松弛连住，把海边、酒店和后海做成完整体验。';
    nightStrategy = '推荐全程住海棠湾，不需要频繁换酒店。';
    candidateIds = ['hn_hotel_1', 'hn_hotel_2', 'hn_hotel_3'];
  } else if (includesHaitang) {
    summary = '如果路线兼顾海棠湾和市区，优先选海棠湾中高品质酒店或市区高品质酒店，减少横跳。';
    nightStrategy = '高效模式尽量少换酒店，除非明确外扩过夜。';
    candidateIds = ['hn_hotel_3', 'hn_hotel_5', 'hn_hotel_4'];
  }

  const items = candidateIds
    .map((id) => hotels.find((item) => item.id === id))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      name: item.name,
      area: item.area,
      decision: item.decision,
      nightlyPriceRange: item.nightlyPriceRange,
      stayStyle: item.stayStyle,
      routeRole: item.routeRole,
      sourcePlatform: item.sourcePlatform,
      qualityLabel: (item.avgCost || 0) >= 800 ? '高品质度假型' : '中高品质稳定型'
    }));

  if (!items.length) return null;

  return {
    title: '住宿建议',
    summary,
    nightStrategy,
    items
  };
}

function attachEnhancedStayToDayPlans(city, input, dayPlans, stayPlan, selectedPlaces) {
  if (city.id !== 'hainan') {
    return attachStayToDayPlans(city, input, dayPlans, stayPlan, selectedPlaces);
  }

  if (!stayPlan || !stayPlan.items || !stayPlan.items.length) {
    return { dayPlans, selectedPlaces, stayPlan };
  }

  const hotelById = (city.hotels || []).reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const defaultHotelId = stayPlan.items[0].id;
  const nightlyHotelIds = dayPlans.map((day) => {
    const area = day.area || '';
    if (area.includes('万宁石梅湾-日月湾')) {
      return stayPlan.items.find((item) => item.id === 'hn_hotel_7' || item.id === 'hn_hotel_8')?.id || defaultHotelId;
    }
    if (area.includes('陵水清水湾-分界洲')) {
      return stayPlan.items.find((item) => item.id === 'hn_hotel_6')?.id || defaultHotelId;
    }
    if (area.includes('三亚亚龙湾-市区')) {
      return stayPlan.items.find((item) => item.id === 'hn_hotel_5' || item.id === 'hn_hotel_4')?.id || defaultHotelId;
    }
    if (area.includes('三亚海棠湾-后海')) {
      return stayPlan.items.find((item) => item.id === 'hn_hotel_3' || item.id === 'hn_hotel_1' || item.id === 'hn_hotel_2')?.id || defaultHotelId;
    }
    return defaultHotelId;
  });

  const nextDayPlans = dayPlans.map((day, dayIndex) => {
    const hotel = hotelById[nightlyHotelIds[dayIndex]];
    if (!hotel) return day;

    return {
      ...day,
      stayMeta: {
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelArea: hotel.area,
        isSwitchNight: dayIndex > 0 && nightlyHotelIds[dayIndex - 1] !== hotel.id,
        stayTransition:
          dayIndex === 0
            ? `第 1 晚入住 ${hotel.name}`
            : nightlyHotelIds[dayIndex - 1] !== hotel.id
              ? `第 ${day.dayNumber} 晚换住 ${hotel.name}`
              : `第 ${day.dayNumber} 晚继续住 ${hotel.name}`
      },
      items: [
        ...day.items,
        {
          startTime: day.items[day.items.length - 1]?.endTime || '20:30',
          endTime: '23:59',
          placeId: hotel.id,
          placeName: hotel.name,
          placeType: 'hotel',
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          action: dayIndex === dayPlans.length - 1 ? '回到住宿 / 收尾休息' : '入住 / 放行李 / 夜间休息',
          duration: 0,
          reason: hotel.recommendReason || hotel.summary,
          tips: hotel.riskTips || city.tip,
          updatedAt: hotel.updatedAt || city.updatedAt,
          statusTags: hotel.statusTags || city.statusTags,
          area: hotel.area || hotel.subArea || '',
          areaCluster: inferAreaCluster(city, hotel),
          trustLevel: hotel.trustLevel || 'high',
          sourcePlatform: hotel.sourcePlatform || []
        }
      ]
    };
  });

  const hotelItems = nightlyHotelIds
    .map((id) => hotelById[id])
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((target) => target.id === item.id) === index);

  hotelItems.forEach((item) => {
    if (!selectedPlaces.find((current) => current.id === item.id)) {
      selectedPlaces.push(item);
    }
  });

  return {
    dayPlans: nextDayPlans,
    selectedPlaces,
    stayPlan: {
      ...stayPlan,
      assignments: nextDayPlans.map((day, index) => ({
        dayNumber: day.dayNumber,
        dayTitle: day.dayTitle,
        hotelId: nightlyHotelIds[index],
        hotelName: hotelById[nightlyHotelIds[index]]?.name || '',
        area: hotelById[nightlyHotelIds[index]]?.area || '',
        isSwitchNight: !!(index > 0 && nightlyHotelIds[index - 1] !== nightlyHotelIds[index]),
        transitionText:
          index === 0
            ? `第 1 晚入住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
            : nightlyHotelIds[index - 1] !== nightlyHotelIds[index]
              ? `第 ${index + 1} 晚换住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
              : `第 ${index + 1} 晚继续住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
      }))
    }
  };
}

function estimateBudget(days, mode, city, selectedPlaces) {
  const foodBase = selectedPlaces
    .filter((item) => item.type === 'food')
    .reduce((sum, item) => sum + (item.avgCost || 80), 0);
  const spotBase = selectedPlaces
    .filter((item) => item.type === 'spot')
    .reduce((sum, item) => sum + (item.avgCost || 0), 0);
  const modeMultiplier = mode === 'hardcore' ? 0.9 : 1.05;
  const base = (foodBase + spotBase + city.baseTransport * days) * modeMultiplier;
  return `${Math.round(base * 0.85)}-${Math.round(base * 1.15)}`;
}

function generateRoute(input) {
  const city = destinationMap[input.destination];
  if (!city) return null;

  const customRoute =
    city.id === 'suzhou'
      ? input.mode === 'relaxed'
        ? buildSuzhouRelaxedRoute(city, input)
        : buildSuzhouHardcoreRoute(city, input)
      : buildGenericRoute(city, input);

  const paceDesc =
    input.mode === 'hardcore'
      ? city.id === 'suzhou'
        ? '优先覆盖经典地标和代表性片区，转场更紧凑，适合高效刷城。'
        : '高密度打卡，适合时间紧张的行程。'
      : city.id === 'suzhou'
        ? '更强调古城慢逛、休息点和顺路收尾的松弛路线。'
        : '节奏更松弛，适合慢慢体验城市。';

  const enriched = attachStayToDayPlans(
    city,
    input,
    customRoute.dayPlans,
    buildStayPlan(city, input, customRoute.dayPlans),
    [...customRoute.selectedPlaces]
  );

  return {
    routeId: `${city.id}_${input.mode}_${input.days}`,
    destinationId: city.id,
    destination: city.name,
    mode: input.mode,
    days: input.days,
    budgetEstimate: estimateBudget(input.days, input.mode, city, enriched.selectedPlaces),
    paceDesc,
    fitSummary: input.mode === 'hardcore' ? '偏高密度覆盖' : '偏体验舒适',
    dayPlans: enriched.dayPlans,
    selectedPlaces: enriched.selectedPlaces,
    stayPlan: enriched.stayPlan
  };
}

function generateRouteV2(input) {
  const city = destinationMap[input.destination];
  if (!city) return null;

  const customRoute =
    city.id === 'suzhou'
      ? input.mode === 'relaxed'
        ? buildSuzhouRelaxedRoute(city, input)
        : buildSuzhouHardcoreRoute(city, input)
      : city.id === 'hainan'
        ? input.mode === 'relaxed'
          ? buildHainanRelaxedRoute(city, input)
          : buildHainanHardcoreRoute(city, input)
        : buildGenericRoute(city, input);

  const paceDesc =
    input.mode === 'hardcore'
      ? city.id === 'suzhou'
        ? '优先覆盖经典地标和代表性片区，转场更紧凑，适合高效刷城。'
        : city.id === 'hainan'
          ? '优先把三亚核心线和外扩海岸线压缩串联，适合时间紧但仍想看清海南玩法层次的行程。'
          : '高密度打卡，适合时间紧张的行程。'
      : city.id === 'suzhou'
        ? '更强调古城慢逛、休息点和顺路收尾的松弛路线。'
        : city.id === 'hainan'
          ? '更强调海边留白、区域完整性和住宿联动，适合把海南玩得舒服而不是只剩赶路。'
          : '节奏更松弛，适合慢慢体验城市。';

  const enriched = attachEnhancedStayToDayPlans(
    city,
    input,
    customRoute.dayPlans,
    buildEnhancedStayPlan(city, input, customRoute.dayPlans),
    [...customRoute.selectedPlaces]
  );

  return {
    routeId: `${city.id}_${input.mode}_${input.days}`,
    destinationId: city.id,
    destination: city.name,
    mode: input.mode,
    days: input.days,
    budgetEstimate: estimateBudget(input.days, input.mode, city, enriched.selectedPlaces),
    paceDesc,
    fitSummary: input.mode === 'hardcore' ? '偏高密度覆盖' : '偏体验舒适',
    dayPlans: enriched.dayPlans,
    selectedPlaces: enriched.selectedPlaces,
    stayPlan: enriched.stayPlan
  };
}

function buildSanyaRelaxedRoute(city, input) {
  const configsByDay = {
    1: [
      {
        title: '海棠湾松弛首日',
        area: '海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '先把海棠湾和后海的度假感走完整，不急着把三亚做碎。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发 / 进入海边节奏', type: 'base' },
          { startTime: '10:20', endTime: '12:00', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:30', action: '午餐：海棠湾稳妥正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:20', action: '下午主线：蜈支洲岛海岛体验段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:40', endTime: '16:15', action: '海边补给：咖啡休息', type: 'food', placeId: 'hn_food_11' },
          { startTime: '16:35', endTime: '17:20', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：糟粕醋正餐位', type: 'food', placeId: 'hn_food_4' }
        ]
      }
    ],
    2: [
      {
        title: '海棠湾与后海松弛线',
        area: '海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '第一天先稳住海边度假感。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发 / 留足酒店节奏', type: 'base' },
          { startTime: '10:20', endTime: '12:00', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:30', action: '午餐：海棠湾稳妥正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:20', action: '下午主线：蜈支洲岛海岛体验段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:40', endTime: '16:15', action: '补给：椰子甜品缓冲高温', type: 'food', placeId: 'hn_food_13' },
          { startTime: '16:35', endTime: '17:20', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：差异化糟粕醋正餐', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '市区海景与日落线',
        area: '市区海边-鹿回头',
        totalDuration: '7-8小时',
        trafficSummary: '第二天切到市区海边，把日落、散步和正餐做完整。',
        slots: [
          { startTime: '09:50', endTime: '10:20', action: '从酒店出发 / 向市区推进', type: 'base' },
          { startTime: '10:35', endTime: '11:20', action: '上午补位：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '11:40', endTime: '12:50', action: '午餐：更生活化的家常热炒', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:20', endTime: '14:35', action: '下午主线：小东海轻海边段', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:50', endTime: '15:15', action: '下午补给：清补凉降温', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:10', endTime: '17:25', action: '傍晚主线：鹿回头城市海景', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:50', endTime: '19:15', action: '晚餐：海南私房菜正餐', type: 'food', placeId: 'hn_food_1' }
        ]
      }
    ],
    3: [
      {
        title: '海棠湾度假主线',
        area: '海棠湾-后海',
        totalDuration: '7-8小时',
        trafficSummary: '先把最像度假的一条线走稳。',
        slots: [
          { startTime: '09:30', endTime: '10:10', action: '早餐后慢出发', type: 'base' },
          { startTime: '10:20', endTime: '12:00', action: '上午主线：后海村慢玩', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '12:20', endTime: '13:30', action: '午餐：海棠湾稳妥正餐', type: 'food', placeId: 'hn_food_3' },
          { startTime: '14:00', endTime: '15:20', action: '下午主线：蜈支洲岛海岛体验段', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '15:40', endTime: '16:15', action: '海边补给：咖啡停靠', type: 'food', placeId: 'hn_food_11' },
          { startTime: '16:35', endTime: '17:20', action: '傍晚自由留给海边散步 / 看日落', type: 'base' },
          { startTime: '17:45', endTime: '19:05', action: '晚餐：糟粕醋正餐位', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '市区海景与日落海边',
        area: '市区海边-鹿回头',
        totalDuration: '7-8小时',
        trafficSummary: '第二天把三亚市区海景和日落线吃透。',
        slots: [
          { startTime: '09:40', endTime: '10:10', action: '从酒店出发 / 切向市区', type: 'base' },
          { startTime: '10:25', endTime: '11:10', action: '上午补位：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '11:30', endTime: '12:40', action: '午餐：轻一点但不敷衍的鸡饭', type: 'food', placeId: 'hn_food_5' },
          { startTime: '13:10', endTime: '14:35', action: '下午主线：小东海轻海边线', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:50', endTime: '15:15', action: '下午补给：清补凉休息', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:00', endTime: '17:20', action: '傍晚主线：鹿回头看日落和城市海景', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:45', endTime: '19:10', action: '晚餐：海南私房菜正餐', type: 'food', placeId: 'hn_food_1' }
        ]
      },
      {
        title: '三亚进阶补强日',
        area: '亚龙湾-太阳湾',
        totalDuration: '7-8小时',
        trafficSummary: '第三天用山海视角、海岛补充和海鲜收口，把三亚拉开层次。',
        slots: [
          { startTime: '09:00', endTime: '09:30', action: '出发切向亚龙湾', type: 'base' },
          { startTime: '09:45', endTime: '11:15', action: '上午主线：亚龙湾森林公园半日线', type: 'spot', placeId: 'hn_spot_8' },
          { startTime: '11:35', endTime: '12:45', action: '午餐：家常热炒正餐', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:20', endTime: '15:10', action: '下午主线：西岛慢玩补充段', type: 'spot', placeId: 'hn_spot_7' },
          { startTime: '15:35', endTime: '16:00', action: '下午补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:30', endTime: '17:15', action: '傍晚轻散步：椰梦长廊', type: 'spot', placeId: 'hn_spot_5' },
          { startTime: '17:45', endTime: '19:15', action: '晚餐：正式海鲜餐位', type: 'food', placeId: 'hn_food_2' }
        ]
      }
    ],
    4: []
  };

  configsByDay[4] = [
    ...configsByDay[3],
    {
      title: '海边留白与二刷日',
      area: '亚龙湾-太阳湾 / 市区海边-鹿回头',
      totalDuration: '6-7小时',
      trafficSummary: '第四天不再硬塞新区域，留给二刷和更舒服的海边节奏。',
      slots: [
        { startTime: '10:00', endTime: '10:30', action: '机动慢出发 / 调整节奏', type: 'base' },
        { startTime: '10:45', endTime: '11:30', action: '上午补位：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
        { startTime: '11:50', endTime: '13:00', action: '午餐：海南私房菜或家常热炒', type: 'food', placeId: 'hn_food_14' },
        { startTime: '13:30', endTime: '14:30', action: '下午主线：椰梦长廊散步', type: 'spot', placeId: 'hn_spot_5' },
        { startTime: '14:50', endTime: '15:20', action: '下午补给：海边咖啡或冷饮', type: 'food', placeId: 'hn_food_10' },
        { startTime: '15:50', endTime: '16:40', action: '海边自由留白 / 酒店休息', type: 'base' },
        { startTime: '17:10', endTime: '18:40', action: '晚餐：海鲜或糟粕醋收尾', type: 'food', placeId: 'hn_food_2' }
      ]
    }
  ];

  const configs =
    input.days <= 4
      ? configsByDay[Math.min(input.days, 4)]
      : [
          ...configsByDay[4],
          ...Array.from({ length: input.days - 4 }, (_, index) => ({
            title: `三亚机动松弛 Day ${index + 5}`,
            area: '市区海边-鹿回头',
            totalDuration: '6-7小时',
            trafficSummary: '补海边留白、酒店度假和没来得及吃的正餐，不再强行堆新点。',
            slots: [
              { startTime: '10:00', endTime: '10:30', action: '机动慢出发', type: 'base' },
              { startTime: '10:50', endTime: '11:40', action: '上午海边散步补位', type: 'spot', placeId: 'hn_spot_5' },
              { startTime: '12:00', endTime: '13:10', action: '午餐：稳定正餐', type: 'food', placeId: 'hn_food_14' },
              { startTime: '13:40', endTime: '14:40', action: '下午海边轻体验', type: 'spot', placeId: 'hn_spot_6' },
              { startTime: '15:00', endTime: '15:25', action: '下午补给：冷饮休息', type: 'food', placeId: 'hn_food_10' },
              { startTime: '16:00', endTime: '16:50', action: '海边自由留白', type: 'base' },
              { startTime: '17:20', endTime: '18:40', action: '晚餐：海鲜正餐', type: 'food', placeId: 'hn_food_2' }
            ]
          }))
        ];

  return buildCustomRouteFromConfigs(city, configs.slice(0, input.days));
}

function buildSanyaHardcoreRoute(city, input) {
  const configsByDay = {
    1: [
      {
        title: '三亚高效首刷日',
        area: '海棠湾-后海 / 市区海边-鹿回头',
        totalDuration: '9-10小时',
        trafficSummary: '把三亚最核心的海边和城市海景压进同一天。',
        slots: [
          { startTime: '08:20', endTime: '08:50', action: '尽早出发', type: 'base' },
          { startTime: '09:10', endTime: '10:15', action: '第一站：后海村', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '10:35', endTime: '11:45', action: '第二站：蜈支洲岛压缩体验', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '12:05', endTime: '13:00', action: '午餐：海南鸡饭轻正餐', type: 'food', placeId: 'hn_food_5' },
          { startTime: '13:30', endTime: '14:05', action: '第三站：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '14:30', endTime: '15:20', action: '第四站：小东海', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '15:35', endTime: '16:00', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:30', endTime: '17:35', action: '第五站：鹿回头', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '18:00', endTime: '19:20', action: '晚餐：海南私房菜', type: 'food', placeId: 'hn_food_1' }
        ]
      }
    ],
    2: [
      {
        title: '海棠湾压缩主线',
        area: '海棠湾-后海',
        totalDuration: '9-10小时',
        trafficSummary: '第一天优先高效覆盖海棠湾和后海。',
        slots: [
          { startTime: '08:30', endTime: '09:00', action: '尽早出发', type: 'base' },
          { startTime: '09:20', endTime: '10:30', action: '第一站：后海村', type: 'spot', placeId: 'hn_spot_1' },
          { startTime: '10:50', endTime: '12:05', action: '第二站：蜈支洲岛压缩体验', type: 'spot', placeId: 'hn_spot_2' },
          { startTime: '12:20', endTime: '13:10', action: '午餐：海棠湾正餐快收口', type: 'food', placeId: 'hn_food_3' },
          { startTime: '13:35', endTime: '14:10', action: '第三站：海边自由停留', type: 'base' },
          { startTime: '14:30', endTime: '15:00', action: '补给：甜品或冷饮', type: 'food', placeId: 'hn_food_13' },
          { startTime: '15:30', endTime: '16:15', action: '第四站：酒店或近海自由活动', type: 'base' },
          { startTime: '16:40', endTime: '18:00', action: '晚餐：糟粕醋差异化正餐', type: 'food', placeId: 'hn_food_4' }
        ]
      },
      {
        title: '市区压缩日',
        area: '亚龙湾-太阳湾 / 市区海边-鹿回头',
        totalDuration: '9-10小时',
        trafficSummary: '第二天集中完成公路观景、市区海边和日落收尾。',
        slots: [
          { startTime: '08:45', endTime: '09:10', action: '出发切向亚龙湾', type: 'base' },
          { startTime: '09:30', endTime: '10:10', action: '第一站：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
          { startTime: '10:35', endTime: '11:45', action: '第二站：亚龙湾森林公园', type: 'spot', placeId: 'hn_spot_8' },
          { startTime: '12:05', endTime: '13:00', action: '午餐：家常热炒快收口', type: 'food', placeId: 'hn_food_14' },
          { startTime: '13:25', endTime: '14:15', action: '第三站：小东海', type: 'spot', placeId: 'hn_spot_6' },
          { startTime: '14:30', endTime: '15:10', action: '第四站：椰梦长廊快速散步', type: 'spot', placeId: 'hn_spot_5' },
          { startTime: '15:25', endTime: '15:50', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
          { startTime: '16:20', endTime: '17:25', action: '第五站：鹿回头收尾', type: 'spot', placeId: 'hn_spot_4' },
          { startTime: '17:50', endTime: '19:15', action: '晚餐：正式海鲜餐位', type: 'food', placeId: 'hn_food_2' }
        ]
      }
    ],
    3: [],
    4: []
  };

  configsByDay[3] = [
    ...configsByDay[2],
    {
      title: '三亚补强高效日',
      area: '亚龙湾-太阳湾 / 市区海边-鹿回头',
      totalDuration: '9-10小时',
      trafficSummary: '第三天补西岛、海景和剩余高价值餐位。',
      slots: [
        { startTime: '08:40', endTime: '09:10', action: '出发', type: 'base' },
        { startTime: '09:40', endTime: '11:20', action: '第一站：西岛压缩体验段', type: 'spot', placeId: 'hn_spot_7' },
        { startTime: '11:45', endTime: '12:35', action: '午餐：鸡饭轻正餐', type: 'food', placeId: 'hn_food_5' },
        { startTime: '13:05', endTime: '14:10', action: '第二站：亚龙湾森林公园补强', type: 'spot', placeId: 'hn_spot_8' },
        { startTime: '14:35', endTime: '15:00', action: '补给：冷饮快速缓冲', type: 'food', placeId: 'hn_food_10' },
        { startTime: '15:30', endTime: '16:15', action: '第三站：椰梦长廊或小东海补位', type: 'spot', placeId: 'hn_spot_5' },
        { startTime: '16:45', endTime: '18:05', action: '晚餐：海鲜正餐', type: 'food', placeId: 'hn_food_2' }
      ]
    }
  ];

  configsByDay[4] = [
    ...configsByDay[3],
    {
      title: '海边二刷高效日',
      area: '海棠湾-后海 / 市区海边-鹿回头',
      totalDuration: '8-9小时',
      trafficSummary: '第四天用于二刷高价值海边段和补体验，不再增加无效新区域。',
      slots: [
        { startTime: '09:00', endTime: '09:25', action: '机动出发', type: 'base' },
        { startTime: '09:45', endTime: '10:55', action: '第一站：后海村二刷或补拍照', type: 'spot', placeId: 'hn_spot_1' },
        { startTime: '11:20', endTime: '12:10', action: '午餐：家常热炒', type: 'food', placeId: 'hn_food_14' },
        { startTime: '12:40', endTime: '13:35', action: '第二站：太阳湾公路观景段', type: 'spot', placeId: 'hn_spot_3' },
        { startTime: '13:55', endTime: '14:20', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
        { startTime: '14:45', endTime: '15:35', action: '第三站：小东海补位', type: 'spot', placeId: 'hn_spot_6' },
        { startTime: '16:00', endTime: '17:20', action: '晚餐：海南私房菜或海鲜正餐', type: 'food', placeId: 'hn_food_1' }
      ]
    }
  ];

  const configs =
    input.days <= 4
      ? configsByDay[Math.min(input.days, 4)]
      : [
          ...configsByDay[4],
          ...Array.from({ length: input.days - 4 }, (_, index) => ({
            title: `三亚高效机动 Day ${index + 5}`,
            area: '市区海边-鹿回头',
            totalDuration: '8-9小时',
            trafficSummary: '补未覆盖点位和想二刷的海边时段，避免继续无意义拉长转场。',
            slots: [
              { startTime: '09:00', endTime: '09:25', action: '机动出发', type: 'base' },
              { startTime: '09:45', endTime: '10:55', action: '上午补位：亚龙湾森林公园', type: 'spot', placeId: 'hn_spot_8' },
              { startTime: '11:20', endTime: '12:10', action: '午餐：轻正餐', type: 'food', placeId: 'hn_food_5' },
              { startTime: '12:40', endTime: '13:35', action: '第二站：椰梦长廊', type: 'spot', placeId: 'hn_spot_5' },
              { startTime: '13:55', endTime: '14:20', action: '补给：清补凉', type: 'food', placeId: 'hn_food_10' },
              { startTime: '14:45', endTime: '15:35', action: '第三站：小东海', type: 'spot', placeId: 'hn_spot_6' },
              { startTime: '16:00', endTime: '17:20', action: '晚餐：海鲜正餐', type: 'food', placeId: 'hn_food_2' }
            ]
          }))
        ];

  return buildCustomRouteFromConfigs(city, configs.slice(0, input.days));
}

function buildEnhancedStayPlanV2(city, input, dayPlans) {
  if (city.id === 'sanya') {
    const hotels = (city.hotels || []).filter((item) => (item.recommendScore || 0) >= 4.3 && (item.avgCost || 0) >= 760);
    if (!hotels.length) return null;

    const areaText = dayPlans.map((day) => day.area || '').join(' / ');
    const includesHaitang = areaText.includes('海棠湾') || areaText.includes('后海');
    const candidateIds = includesHaitang ? ['hn_hotel_1', 'hn_hotel_2', 'hn_hotel_3'] : ['hn_hotel_5', 'hn_hotel_4', 'hn_hotel_3'];
    const summary = includesHaitang
      ? input.mode === 'relaxed'
        ? '海棠湾更适合松弛连住，把海边、酒店和后海做成完整体验。'
        : '如果路线兼顾海棠湾和市区，优先选交通更稳的海棠湾中高品质酒店。'
      : '路线重心偏市区与亚龙湾时，住市区海边或亚龙湾会更顺。';
    const nightStrategy = includesHaitang
      ? '推荐全程住海棠湾，不需要频繁换酒店。'
      : '建议全程住同一家三亚酒店，减少收拾和折返。';

    const items = candidateIds
      .map((id) => hotels.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        name: item.name,
        area: item.area,
        decision: item.decision,
        nightlyPriceRange: item.nightlyPriceRange,
        stayStyle: item.stayStyle,
        routeRole: item.routeRole,
        sourcePlatform: item.sourcePlatform,
        qualityLabel: (item.avgCost || 0) >= 800 ? '高品质度假型' : '中高品质稳定型'
      }));

    return items.length
      ? {
          title: '住宿建议',
          summary,
          nightStrategy,
          items
        }
      : null;
  }

  if (city.id === 'lingshui' || city.id === 'wanning') {
    const hotels = [...(city.hotels || [])].sort((a, b) => (b.recommendScore || 0) - (a.recommendScore || 0));
    if (!hotels.length) return null;
    return {
      title: '住宿建议',
      summary:
        city.id === 'lingshui'
          ? '陵水当前更适合作为 1 天游或 1 晚外扩目的地，优先住清水湾附近。'
          : '万宁当前更适合作为海岸线外扩目的地，优先住石梅湾或神州半岛附近。',
      nightStrategy:
        city.id === 'lingshui'
          ? '推荐清水湾住 1 晚，次日再慢慢收尾。'
          : '推荐石梅湾或神州半岛住 1 晚，不建议当天来回压缩。',
      items: hotels.slice(0, 2).map((item) => ({
        id: item.id,
        name: item.name,
        area: item.area,
        decision: item.decision,
        nightlyPriceRange: item.nightlyPriceRange,
        stayStyle: item.stayStyle,
        routeRole: item.routeRole,
        sourcePlatform: item.sourcePlatform,
        qualityLabel: (item.avgCost || 0) >= 800 ? '高品质度假型' : '中高品质稳定型'
      }))
    };
  }

  return buildStayPlan(city, input, dayPlans);
}

function attachEnhancedStayToDayPlansV2(city, input, dayPlans, stayPlan, selectedPlaces) {
  if (!['sanya', 'lingshui', 'wanning'].includes(city.id)) {
    return attachStayToDayPlans(city, input, dayPlans, stayPlan, selectedPlaces);
  }

  if (!stayPlan || !stayPlan.items || !stayPlan.items.length) {
    return { dayPlans, selectedPlaces, stayPlan };
  }

  const hotelById = (city.hotels || []).reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const defaultHotelId = stayPlan.items[0].id;
  const nightlyHotelIds = dayPlans.map((day) => {
    if (city.id === 'lingshui') return stayPlan.items[0].id;
    if (city.id === 'wanning') return stayPlan.items[0].id;

    const area = day.area || '';
    if (area.includes('市区') || area.includes('亚龙湾')) {
      return stayPlan.items.find((item) => item.id === 'hn_hotel_5' || item.id === 'hn_hotel_4')?.id || defaultHotelId;
    }
    if (area.includes('海棠湾') || area.includes('后海')) {
      return stayPlan.items.find((item) => item.id === 'hn_hotel_3' || item.id === 'hn_hotel_1' || item.id === 'hn_hotel_2')?.id || defaultHotelId;
    }
    return defaultHotelId;
  });

  const nextDayPlans = dayPlans.map((day, dayIndex) => {
    const hotel = hotelById[nightlyHotelIds[dayIndex]];
    if (!hotel) return day;

    return {
      ...day,
      stayMeta: {
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelArea: hotel.area,
        isSwitchNight: dayIndex > 0 && nightlyHotelIds[dayIndex - 1] !== hotel.id,
        stayTransition:
          dayIndex === 0
            ? `第 1 晚入住 ${hotel.name}`
            : nightlyHotelIds[dayIndex - 1] !== hotel.id
              ? `第 ${day.dayNumber} 晚换住 ${hotel.name}`
              : `第 ${day.dayNumber} 晚继续住 ${hotel.name}`
      },
      items: [
        ...day.items,
        {
          startTime: day.items[day.items.length - 1]?.endTime || '20:30',
          endTime: '23:59',
          placeId: hotel.id,
          placeName: hotel.name,
          placeType: 'hotel',
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          action: dayIndex === dayPlans.length - 1 ? '回到住宿 / 收尾休息' : '入住 / 放行李 / 夜间休息',
          duration: 0,
          reason: hotel.recommendReason || hotel.summary,
          tips: hotel.riskTips || city.tip,
          updatedAt: hotel.updatedAt || city.updatedAt,
          statusTags: hotel.statusTags || city.statusTags,
          area: hotel.area || hotel.subArea || '',
          areaCluster: inferAreaCluster(city, hotel),
          trustLevel: hotel.trustLevel || 'high',
          sourcePlatform: hotel.sourcePlatform || []
        }
      ]
    };
  });

  const hotelItems = nightlyHotelIds
    .map((id) => hotelById[id])
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((target) => target.id === item.id) === index);

  hotelItems.forEach((item) => {
    if (!selectedPlaces.find((current) => current.id === item.id)) {
      selectedPlaces.push(item);
    }
  });

  return {
    dayPlans: nextDayPlans,
    selectedPlaces,
    stayPlan: {
      ...stayPlan,
      assignments: nextDayPlans.map((day, index) => ({
        dayNumber: day.dayNumber,
        dayTitle: day.dayTitle,
        hotelId: nightlyHotelIds[index],
        hotelName: hotelById[nightlyHotelIds[index]]?.name || '',
        area: hotelById[nightlyHotelIds[index]]?.area || '',
        isSwitchNight: !!(index > 0 && nightlyHotelIds[index - 1] !== nightlyHotelIds[index]),
        transitionText:
          index === 0
            ? `第 1 晚入住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
            : nightlyHotelIds[index - 1] !== nightlyHotelIds[index]
              ? `第 ${index + 1} 晚换住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
              : `第 ${index + 1} 晚继续住 ${hotelById[nightlyHotelIds[index]]?.name || ''}`
      }))
    }
  };
}

function generateRouteV3(input) {
  const city = destinationMap[input.destination];
  if (!city) return null;

  const customRoute =
    city.id === 'suzhou'
      ? input.mode === 'relaxed'
        ? buildSuzhouRelaxedRoute(city, input)
        : buildSuzhouHardcoreRoute(city, input)
      : city.id === 'sanya'
        ? input.mode === 'relaxed'
          ? buildSanyaRelaxedRoute(city, input)
          : buildSanyaHardcoreRoute(city, input)
        : buildGenericRoute(city, input);

  const paceDesc =
    input.mode === 'hardcore'
      ? city.id === 'sanya'
        ? '优先把三亚核心海边、公路观景和城市日落线压缩串联，适合时间紧但仍想玩明白三亚的人。'
        : city.id === 'suzhou'
          ? '优先覆盖经典地标和代表性片区，转场更紧凑，适合高效刷城。'
          : '高密度打卡，适合时间紧张的行程。'
      : city.id === 'sanya'
        ? '更强调海边留白、正餐层次和住宿联动，适合把三亚玩得舒服而不是一直赶路。'
        : city.id === 'suzhou'
          ? '更强调古城慢逛、休息点和顺路收尾的松弛路线。'
          : '节奏更松弛，适合慢慢体验城市。';

  const enriched = attachEnhancedStayToDayPlansV2(
    city,
    input,
    customRoute.dayPlans,
    buildEnhancedStayPlanV2(city, input, customRoute.dayPlans),
    [...customRoute.selectedPlaces]
  );

  return {
    routeId: `${city.id}_${input.mode}_${input.days}`,
    destination: city.name,
    mode: input.mode,
    days: input.days,
    budgetEstimate: estimateBudget(input.days, input.mode, city, enriched.selectedPlaces),
    paceDesc,
    fitSummary: input.mode === 'hardcore' ? '偏高密度覆盖' : '偏体验舒适',
    dayPlans: enriched.dayPlans,
    selectedPlaces: enriched.selectedPlaces,
    stayPlan: enriched.stayPlan
  };
}

module.exports = {
  generateRoute: generateRouteV3
};
