const { destinations, destinationMap } = require('./travelData');

module.exports = {
  destinations,
  destinationMap,
  recommendations: destinations.flatMap((city) => [...city.spots, ...city.foods]),
  routes: []
};
