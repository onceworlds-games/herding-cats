// Herding Cats joins its server the moment the page loads, before the big game script is even parsed, so a reloaded
// page gets its seat back at once. The game reads window.__hcJOIN (the options) and window.__hcJoin (the join) from here.
(function () {
  var JOIN = {
    maxPlayers: 6,
    minPlayers: 1,
    lobby: 'bar',
    ownCountdown: true,
    countdown: 3,
    settings: [
      { id: 'game', label: 'Game', options: [{ value: 'versus', label: 'Versus' }, { value: 'together', label: 'Together' }], default: 'versus' },
      { id: 'rounds', label: 'Rounds', options: [1, 3, 5], default: 3 },
    ],
  };
  window.__hcJOIN = JOIN;
  try {
    var q = new URLSearchParams(location.search);
    var skip = q.has('poster') || (q.has('autoplay') && !/onceworlds\.com$/.test(location.hostname));
    var ow = window.onceworlds;
    if (!skip && ow && ow.rooms) {
      window.__hcJoin = Promise.resolve().then(function () { return ow.rooms.join(JOIN); }).catch(function () { return null; });
    }
  } catch (e) { /* the game joins itself */ }
})();
