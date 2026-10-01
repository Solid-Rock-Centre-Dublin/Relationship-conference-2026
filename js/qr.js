/*
  Small QR code generator.
  Byte mode, error correction level M, versions 1 to 10 (up to 213 characters).
  Exposes:
    window.QRCodeMatrix(text) -> { size, modules }   modules[y][x] is 1 for dark
    window.QRCodeSVG(text)    -> SVG string with a 4 module quiet zone
*/
(function () {
  "use strict";

  // Index = version. Values for error correction level M.
  var ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var MAX_VERSION = 10;

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function dataCodewords(ver) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  function utf8Bytes(text) {
    if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(text));
    var s = unescape(encodeURIComponent(text)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function appendBits(bits, value, len) {
    for (var i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  }

  /* ---------- Reed-Solomon over GF(256), polynomial 0x11D ---------- */

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    var result = [], i, j;
    for (i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 2);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  function addEccAndInterleave(data, ver) {
    var nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
    var raw = Math.floor(rawModules(ver) / 8);
    var numShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    var div = rsDivisor(eccLen), blocks = [], i, k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (var j = 0; j < blocks.length; j++) {
        if (i !== shortLen - eccLen || j >= numShort) out.push(blocks[j][i]);
      }
    }
    return out;
  }

  /* ---------- Matrix construction ---------- */

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2;
    var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var size = ver * 4 + 17, res = [6];
    for (var pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function Grid(ver) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.m = [];
    this.fn = [];
    for (var y = 0; y < this.size; y++) {
      var a = [], b = [];
      for (var x = 0; x < this.size; x++) { a.push(0); b.push(false); }
      this.m.push(a);
      this.fn.push(b);
    }
  }

  Grid.prototype.setFn = function (x, y, dark) {
    this.m[y][x] = dark ? 1 : 0;
    this.fn[y][x] = true;
  };

  Grid.prototype.drawFunctionPatterns = function () {
    var size = this.size, i, dx, dy;
    for (i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    var self = this;
    function finder(cx, cy) {
      for (dy = -4; dy <= 4; dy++) {
        for (dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) self.setFn(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);

    var pos = alignmentPositions(this.ver), n = pos.length;
    for (i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (dy = -2; dy <= 2; dy++) {
          for (dx = -2; dx <= 2; dx++) {
            this.setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
    this.drawFormat(0);
    this.drawVersion();
  };

  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  Grid.prototype.drawFormat = function (mask) {
    var size = this.size, i;
    var data = (0 << 3) | mask; // error correction level M has format bits 00
    var rem = data;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    for (i = 0; i <= 5; i++) this.setFn(8, i, bit(bits, i));
    this.setFn(8, 7, bit(bits, 6));
    this.setFn(8, 8, bit(bits, 7));
    this.setFn(7, 8, bit(bits, 8));
    for (i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(bits, i));
    for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(bits, i));
    for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(bits, i));
    this.setFn(8, size - 8, true);
  };

  Grid.prototype.drawVersion = function () {
    if (this.ver < 7) return;
    var rem = this.ver, i;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    var bits = (this.ver << 12) | rem;
    for (i = 0; i < 18; i++) {
      var c = bit(bits, i), a = this.size - 11 + (i % 3), b = Math.floor(i / 3);
      this.setFn(a, b, c);
      this.setFn(b, a, c);
    }
  };

  Grid.prototype.drawCodewords = function (data) {
    var size = this.size, i = 0, right, vert, j;
    for (right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.fn[y][x] && i < data.length * 8) {
            this.m[y][x] = bit(data[i >>> 3], 7 - (i & 7)) ? 1 : 0;
            i++;
          }
        }
      }
    }
  };

  Grid.prototype.applyMask = function (mask) {
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        var inv;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!this.fn[y][x] && inv) this.m[y][x] ^= 1;
      }
    }
  };

  Grid.prototype.penalty = function () {
    var m = this.m, size = this.size, score = 0, x, y, p, run;
    var p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function at(pass, a, b) { return pass ? m[b][a] : m[a][b]; }
    for (var pass = 0; pass < 2; pass++) {
      for (y = 0; y < size; y++) {
        run = 1;
        for (x = 1; x < size; x++) {
          if (at(pass, y, x) === at(pass, y, x - 1)) {
            run++;
            if (run === 5) score += 3; else if (run > 5) score++;
          } else run = 1;
        }
        for (x = 0; x + 11 <= size; x++) {
          var m1 = true, m2 = true;
          for (p = 0; p < 11; p++) {
            var v = at(pass, y, x + p);
            if (v !== p1[p]) m1 = false;
            if (v !== p2[p]) m2 = false;
          }
          if (m1 || m2) score += 40;
        }
      }
    }
    var dark = 0;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        dark += m[y][x];
        if (x + 1 < size && y + 1 < size) {
          var c = m[y][x];
          if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
        }
      }
    }
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  };

  /* ---------- Public API ---------- */

  function build(text) {
    var bytes = utf8Bytes(text), ver, i;
    for (ver = 1; ver <= MAX_VERSION; ver++) {
      var need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= dataCodewords(ver) * 8) break;
    }
    if (ver > MAX_VERSION) throw new Error("QR text is too long");

    var bits = [];
    appendBits(bits, 4, 4);
    appendBits(bits, bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { appendBits(bits, b, 8); });
    var cap = dataCodewords(ver) * 8;
    appendBits(bits, 0, Math.min(4, cap - bits.length));
    appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
    for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);

    var data = [];
    for (i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      data.push(v);
    }

    var grid = new Grid(ver);
    grid.drawFunctionPatterns();
    grid.drawCodewords(addEccAndInterleave(data, ver));

    var best = 0, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      grid.applyMask(mask);
      grid.drawFormat(mask);
      var s = grid.penalty();
      if (s < bestScore) { bestScore = s; best = mask; }
      grid.applyMask(mask); // undo
    }
    grid.applyMask(best);
    grid.drawFormat(best);
    return { size: grid.size, modules: grid.m, version: ver, mask: best };
  }

  window.QRCodeMatrix = build;

  window.QRCodeSVG = function (text, colour) {
    var r = build(text), q = 4, dim = r.size + q * 2, d = "";
    for (var y = 0; y < r.size; y++) {
      var x = 0;
      while (x < r.size) {
        if (r.modules[y][x]) {
          var start = x;
          while (x < r.size && r.modules[y][x]) x++;
          d += "M" + (start + q) + " " + (y + q) + "h" + (x - start) + "v1h-" + (x - start) + "z";
        } else x++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + " " + dim +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code for the question page">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/>' +
      '<path d="' + d + '" fill="' + (colour || "#1b0309") + '"/></svg>';
  };
})();
