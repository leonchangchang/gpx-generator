const map = L.map('map').setView(
    [22.637605, 120.357825],
    16
);

L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19
    }
).addTo(map);

const points = [];
const markers = [];

let polyline = null;

//const info = document.getElementById("info");
const btnClear = document.getElementById("btnClear");

const btnSearch = document.getElementById("btnSearch");
const searchText = document.getElementById("searchText");

const suggestions =
    document.getElementById("suggestions");

const btnExport =
    document.getElementById("btnExport");

const speedInput =
    document.getElementById("speed");

const stepDistanceInput =
    document.getElementById("stepDistance");

const btnCopy =
    document.getElementById("btnCopy");

const pointList =
    document.getElementById("pointList");

map.on('click', function (e) {

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    points.push([lat, lng]);

    updatePointList();

    const marker = L.marker([lat, lng]).addTo(map);
    markers.push(marker);

    if (polyline) {
        map.removeLayer(polyline);
    }

    polyline = L.polyline(points).addTo(map);

    //info.textContent = `點數: ${points.length}`;
});

btnClear.addEventListener("click", () => {

    markers.forEach(m => map.removeLayer(m));

    markers.length = 0;
    points.length = 0;

    updatePointList();

    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }

    //info.textContent = "點數: 0";
});

btnSearch.addEventListener("click", async () => {

    const keyword = searchText.value;

    if (!keyword)
        return;

    const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=jsonv2`;

    const response = await fetch(url);

    const result = await response.json();

    if (result.length === 0) {
        alert("找不到地點");
        return;
    }

    const lat = parseFloat(result[0].lat);
    const lon = parseFloat(result[0].lon);

    map.setView([lat, lon], 17);
});

searchText.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {
        btnSearch.click();
    }

});

let searchTimer = null;

searchText.addEventListener("input", () => {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(
        loadSuggestions,
        300
    );

});

async function loadSuggestions() {

    const keyword =
        searchText.value.trim();

    if (keyword.length < 2) {

        suggestions.style.display =
            "none";

        return;
    }

    const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=jsonv2&limit=10`;

    const response =
        await fetch(url);

    const result =
        await response.json();

    suggestions.innerHTML = "";

    for (const item of result) {

        const div =
            document.createElement("div");

        div.className =
            "suggestion-item";

        div.textContent =
            item.display_name;

        div.addEventListener(
            "click",
            () => {

                searchText.value =
                    item.display_name;

                map.setView(
                    [
                        parseFloat(item.lat),
                        parseFloat(item.lon)
                    ],
                    17
                );

                suggestions.style.display =
                    "none";
            }
        );

        suggestions.appendChild(div);
    }

    suggestions.style.display =
        result.length > 0
            ? "block"
            : "none";
}

searchText.focus();

function generateGpx() {

    if (points.length < 2) {
        alert("至少需要兩個點");
        return;
    }

    const speedKmh =
        parseFloat(speedInput.value);

    const stepDistance =
        parseFloat(stepDistanceInput.value);

    const speedMps =
        speedKmh * 1000 / 3600;

    let currentTime = new Date();

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    gpx += `<gpx version="1.1">\n`;

    for (let segment = 0;
         segment < points.length - 1;
         segment++) {

        const p1 = points[segment];
        const p2 = points[segment + 1];

        const path =
            interpolatePoints(
                p1[0],
                p1[1],
                p2[0],
                p2[1],
                stepDistance
            );

        for (let i = 0; i < path.length; i++) {

            const p = path[i];

            gpx +=
`  <wpt lat="${p.lat}" lon="${p.lon}">
    <time>${currentTime.toISOString()}</time>
  </wpt>\n`;

            currentTime =
                new Date(
                    currentTime.getTime() +
                    (stepDistance / speedMps) * 1000
                );
        }
    }

    gpx += `</gpx>`;

    return gpx;
}

btnExport.addEventListener("click", () => {

    const gpx = generateGpx();

    if (!gpx)
        return;

    const blob =
        new Blob(
            [gpx],
            { type: "application/gpx+xml" }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download = "route.gpx";

    a.click();

    URL.revokeObjectURL(url);
});

btnCopy.addEventListener("click", async () => {

    const gpx = generateGpx();

    if (!gpx)
        return;

    try {

        await navigator.clipboard.writeText(gpx);

        alert("GPX 已複製到剪貼簿");

    }
    catch (err) {

        console.error(err);

        alert("複製失敗");
    }

});

function updatePointList() {

    pointList.innerHTML = "";

    points.forEach((point, index) => {

        const li =
            document.createElement("li");

        li.className =
            "point-item";

        li.textContent =
            `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`;

        const btn =
            document.createElement("button");

        btn.textContent =
            "刪除";

        btn.className =
            "delete-btn";

        btn.addEventListener(
            "click",
            () => removePoint(index)
        );

        li.appendChild(btn);

        pointList.appendChild(li);
    });
}

function interpolatePoints(
    lat1,
    lon1,
    lat2,
    lon2,
    stepMeters
) {

    const distance =
        map.distance(
            [lat1, lon1],
            [lat2, lon2]
        );

    const count =
        Math.max(
            1,
            Math.floor(distance / stepMeters)
        );

    const result = [];

    for (let i = 0; i <= count; i++) {

        const t = i / count;

        result.push({
            lat:
                lat1 +
                (lat2 - lat1) * t,

            lon:
                lon1 +
                (lon2 - lon1) * t
        });
    }

    return result;
}

function removePoint(index) {

    map.removeLayer(markers[index]);

    markers.splice(index, 1);

    points.splice(index, 1);

    redrawPolyline();

    updatePointList();
}

function redrawPolyline() {

    if (polyline) {
        map.removeLayer(polyline);
    }

    if (points.length > 1) {

        polyline =
            L.polyline(points)
             .addTo(map);
    }
}