function looksCorrupted(value) {
  if (typeof value !== 'string' || !value) {
    return false;
  }

  const suspiciousTokens = [
    '鍙', '鏅', '鐨', '浜', '闈', '瑙', '銆', '鈥', '锛', '锟', '', '宀', '婀', '甯', '', '鏉', '鍗', '闄', '璺',
    '鍐', '妗', '鐢', '鐩', '妤', '鐗', '鍧'
  ];

  const hitCount = suspiciousTokens.reduce((sum, token) => sum + (value.includes(token) ? 1 : 0), 0);
  return hitCount >= 2;
}

function pickText(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback || '';
  }
  return looksCorrupted(value) ? fallback || '' : value;
}

function fallbackArea(item) {
  return pickText(item.area, pickText(item.subArea, '城市核心区'));
}

function fallbackSummary(item) {
  const area = fallbackArea(item);
  if (item.type === 'spot') {
    return `${item.name}更适合放进${area}这条线路里，作为顺路可执行的一站。`;
  }
  if (item.type === 'hotel') {
    return `${item.name}更适合作为${area}附近的落脚点，重点看位置、稳定性和路线匹配度。`;
  }

  const foodType = pickText(item.foodType, '');
  const role = pickText(item.routeRole, '');
  if (foodType || role) {
    return `${item.name}更适合放在${area}一带，作为${foodType || role}使用。`;
  }
  return `${item.name}更适合放在${area}一带，作为路线中的顺路补给或正餐节点。`;
}

function fallbackReason(item) {
  if (item.type === 'spot') {
    return `${item.name}在整条路线里更重要的是串联价值和真实体验感。`;
  }
  if (item.type === 'hotel') {
    return `${item.name}优先被保留，是因为它在区域、品质和行程动线上更稳。`;
  }

  const foodRole = pickText(item.routeRole, '');
  if (foodRole) {
    return `${item.name}适合放进路线里做${foodRole}，而不是单独为了打卡绕路。`;
  }
  return `${item.name}更适合作为路线中的稳定用餐节点。`;
}

function fallbackTips(item) {
  if (item.type === 'spot') {
    return '建议结合当天线路顺路安排，避免高峰时段扎堆。';
  }
  if (item.type === 'hotel') {
    return '建议提前锁房，并优先确认实际位置和入住便利度。';
  }
  return '建议错峰用餐，避免把小吃、甜品和正餐混在同一时间段。';
}

function fallbackDecision(item) {
  if (item.type === 'spot') {
    return '值得安排';
  }
  if (item.type === 'hotel') {
    return '适合作为落脚点';
  }
  return getFoodRoleLabel(item);
}

function getFoodRoleLabel(item) {
  const text = [item.foodType, item.routeRole, ...(item.tags || [])].filter(Boolean).join('|');
  if (text.includes('咖啡') || text.includes('甜品') || text.includes('茶')) {
    return '适合作为下午补给';
  }
  if (text.includes('小吃') || text.includes('生煎')) {
    return '适合作为顺路加餐';
  }
  return '适合作为正餐';
}

function cleanTagList(tags, fallbackTags) {
  if (!Array.isArray(tags) || !tags.length || tags.some((tag) => looksCorrupted(tag))) {
    return fallbackTags || [];
  }
  return tags;
}

function sanitizeItem(item) {
  if (!item) {
    return item;
  }

  const typeFallbackTags =
    item.type === 'spot'
      ? ['值得安排', '路线友好']
      : item.type === 'hotel'
        ? ['住宿', '中高质量']
        : ['餐饮', getFoodRoleLabel(item)];

  const cleanItem = {
    ...item
  };

  cleanItem.area = fallbackArea(item);
  cleanItem.summary = pickText(item.summary, fallbackSummary(item));
  cleanItem.recommendReason = pickText(item.recommendReason, fallbackReason(item));
  cleanItem.riskTips = pickText(item.riskTips, fallbackTips(item));
  cleanItem.decision = pickText(item.decision, fallbackDecision(item));
  cleanItem.routeRole = pickText(item.routeRole, item.type === 'food' ? getFoodRoleLabel(item) : '路线节点');
  cleanItem.bestFor = pickText(item.bestFor, '');
  cleanItem.avoidIf = pickText(item.avoidIf, pickText(item.avoidFor, ''));
  cleanItem.trafficAccess = pickText(item.trafficAccess, '建议结合当天路线顺路前往。');
  cleanItem.statusTags = cleanTagList(item.statusTags, typeFallbackTags);
  cleanItem.tags = cleanTagList(item.tags, typeFallbackTags);

  if (Array.isArray(item.alternatives)) {
    cleanItem.alternatives = item.alternatives.filter((value) => typeof value === 'string' && !looksCorrupted(value));
  } else {
    cleanItem.alternatives = [];
  }

  return cleanItem;
}

function sanitizeCity(city) {
  if (!city) {
    return city;
  }

  const cityOverrides = {
    suzhou: {
      intro: '适合园林、水巷、citywalk 和松弛慢游。',
      overview: '苏州更适合白天看园林，傍晚转古城慢逛，晚上收在夜景和正餐体验上。',
      tip: '热门园林和古城周末人流会上升，建议错峰。',
      dayTitles: ['园林与博物馆', '古城慢逛', '太湖外扩'],
      areas: ['拙政园-苏州博物馆', '平江路-十全街-山塘街', '太湖-西山岛']
    },
    jingdezhen: {
      intro: '适合陶瓷、手作、驻留和在地体验。',
      overview: '景德镇更适合边逛边停，节奏不宜太赶，留时间给手作和挑店。',
      tip: '如果重点是买器物或做手作，建议多预留机动时间。',
      dayTitles: ['陶瓷主线', '慢逛收尾'],
      areas: ['陶溪川', '老厂区与在地街区']
    }
  };

  const override = cityOverrides[city.id] || {};

  return {
    ...city,
    intro: pickText(city.intro, override.intro || ''),
    overview: pickText(city.overview, override.overview || ''),
    tip: pickText(city.tip, override.tip || ''),
    dayTitles: cleanTagList(city.dayTitles, override.dayTitles || []),
    areas: cleanTagList(city.areas, override.areas || []),
    spots: (city.spots || []).map(sanitizeItem),
    foods: (city.foods || []).map(sanitizeItem),
    hotels: (city.hotels || []).map(sanitizeItem)
  };
}

function sanitizeDestinations(destinations) {
  return (destinations || []).map(sanitizeCity);
}

function sanitizeRoute(route) {
  if (!route) {
    return route;
  }

  return {
    ...route,
    paceDesc: pickText(route.paceDesc, '按你的时间和节奏生成了一条可执行路线。'),
    fitSummary: pickText(route.fitSummary, route.mode === 'hardcore' ? '偏高密度覆盖' : '偏体验舒适'),
    stayPlan: route.stayPlan
      ? {
          ...route.stayPlan,
          title: pickText(route.stayPlan.title, '住宿建议'),
          summary: pickText(route.stayPlan.summary, '优先选择和路线更顺的住宿区域。'),
          nightStrategy: pickText(route.stayPlan.nightStrategy, ''),
          items: (route.stayPlan.items || []).map(sanitizeItem)
        }
      : null,
    dayPlans: (route.dayPlans || []).map((day) => ({
      ...day,
      dayTitle: pickText(day.dayTitle, `第 ${day.dayNumber} 天行程`),
      area: pickText(day.area, '城市核心区'),
      totalDuration: pickText(day.totalDuration, route.mode === 'hardcore' ? '9-10小时' : '6-8小时'),
      trafficSummary: pickText(day.trafficSummary, '建议按顺路逻辑推进，减少来回折返。'),
      items: (day.items || []).map((item) => ({
        ...item,
        action: pickText(item.action, item.placeType === 'food' ? '用餐补给' : item.placeType === 'hotel' ? '回到住宿休息' : '顺路停留'),
        reason: pickText(item.reason, fallbackReason(item)),
        tips: pickText(item.tips, fallbackTips(item))
      }))
    }))
  };
}

module.exports = {
  looksCorrupted,
  sanitizeItem,
  sanitizeCity,
  sanitizeDestinations,
  sanitizeRoute
};
