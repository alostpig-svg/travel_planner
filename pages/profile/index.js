const { listFavorites, listRouteSaves, listHistory } = require('../../utils/storage');

Page({
  data: {
    favorites: [],
    routes: [],
    history: []
  },

  onShow() {
    this.setData({
      favorites: listFavorites(),
      routes: listRouteSaves(),
      history: listHistory()
    });
  }
});
