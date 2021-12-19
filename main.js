//---------------------------------------------------------
// SETUP
// //------------------------------------------------------
// // MISCELLANEOUS VARIABLES SETUP

const opacity = 0.7
const avgNum = 14
const duration = 225
const excludedStates = ["66", "69", "72", "78"]

// //------------------------------------------------------
// // PAGE SETUP

const body = d3.select('body')
  .style('margin', '0 auto')
  .style('font-family', 'helvetica')
  .style('font-size', '12px')
  .style('overflow', 'auto')

const container = d3.select('#container')
  .style('position', 'relative')
  .style('margin', '0 auto')

// const legendContainer = d3.select('#legendContainer')
//   .style('display', 'flex')
//   .style('flex-direction', 'row')


// //------------------------------------------------------
// // MAP SETUP

const mapContainer = d3.select('#map-container')

const macBounds = d3.select('#mapAndControls').node().getBoundingClientRect()

let mapWidth = macBounds.width
let mapHeight = macBounds.height - 60

const justMapHeight = mapWidth / 1.6
const mapMarginTop = macBounds.height - 50 - justMapHeight
const mapMargin = {top: mapMarginTop, right: 0, bottom: 0, left: 0}
const spikeMax = d3.min([mapMargin.top + 210, justMapHeight * 1.4])
const spikeWidth = mapWidth / 90


// //------------------------------------------------------
// // CANVAS SETUP

const dpi = window.devicePixelRatio

const mapCanvas = mapContainer.append('canvas').attr('class', 'mapCanvas')
  .style('position', 'absolute')
// resizeCanvas()

function resizeCanvas() {
  // console.log('mapWidth', mapWidth)
  // console.log('mapHeight', mapHeight)
  mapCanvas
    .style("width", `${mapWidth}px`)
    .style("height", `${mapHeight}px`)
    .attr("width", `${mapWidth * dpi}`)
    .attr("height", `${mapHeight * dpi}`)
}

resizeCanvas()
const ctx = mapCanvas.node().getContext('2d')
ctx.scale(dpi, dpi)

// //------------------------------------------------------
// // RESIZE OBSERVER

// document.addEventListener('DOMContentLoaded', () => {
  let resizer = new ResizeObserver(handleResize)
  resizer.observe(document.querySelector('#mapAndControls'))

// })

function handleResize(entries) {
  // mapWidth = entries[0].contentRect.width
  // mapHeight = entries[0].contentRect.height - 50
  // resizeCanvas()
}


// //------------------------------------------------------
// // MAP SVG SETUP

const mapSvg = mapContainer.append('svg').attr('class', 'mapSvg')
  // .attr('viewBox', `0 0 ${mapWidth}, ${mapHeight}`)
  .attr('width', mapWidth)
  .attr('height', mapHeight)

// mapSvg.append('text')
//   .attr('transform', () => `translate(${mapWidth / 2},${mapMargin.top / 2})`)
//   .style('text-anchor', 'middle')
//   .style('font-size', () => d3.min([mapWidth/20, 30]))
//   .text('COVID-19 Daily New Cases')

// mapSvg.append('text')
//   .style('text-anchor', 'middle')
//   .style('font-size', () => d3.min([mapWidth/30, 14]))
//   .attr('transform', () => `translate(${mapWidth / 2},${mapMargin.top / 2 + 20})`)
//   .text('Two-Week Rolling Average')

// //------------------------------------------------------
// // CHART SVG SETUP

// const chartContainer = d3.select('#chart-container')
// const chartContainerBounds = chartContainer.node().getBoundingClientRect()
// const width = chartContainerBounds.width
// const height = 900
// const chartSvg = chartContainer.append('svg')
//   .attr('id', 'chartSvg')
//   // .attr('viewBox', `0 0 ${width} ${height}`)
//   .attr('width', width)
//   .attr('height', height)
//   .style('margin', '10 0 0 0')

// //------------------------------------------------------
// // COLOR LEGEND SETUP

const colorContainer = d3.select('#colorContainer')

function legend({
  color,
  title,
  tickSize = 6,
  width = 320,
  height = 44 + tickSize,
  marginTop = 18,
  marginRight = 0,
  marginBottom = 16 + tickSize,
  marginLeft = 0,
  ticks = width / 64,
  tickFormat,
  tickValues
} = {}) {

  const svg = colorContainer.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .style("overflow", "visible")
    .style("display", "block");

  let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
  let x;

  // Continuous
  if (color.interpolate) {
    const n = Math.min(color.domain().length, color.range().length);

    x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

    svg.append("image")
      .attr("x", marginLeft)
      .attr("y", marginTop)
      .attr("width", width - marginLeft - marginRight)
      .attr("height", height - marginTop - marginBottom)
      .attr("preserveAspectRatio", "none")
      .attr("xlink:href", ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
  }

  // Sequential
  else if (color.interpolator) {
    x = Object.assign(color.copy()
        .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
        {range() { return [marginLeft, width - marginRight]; }});

    svg.append("image")
      .attr("x", marginLeft)
      .attr("y", marginTop)
      .attr("width", width - marginLeft - marginRight)
      .attr("height", height - marginTop - marginBottom)
      .attr("preserveAspectRatio", "none")
      .attr("xlink:href", ramp(color.interpolator()).toDataURL())
      .attr('opacity', opacity);

    // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
    if (!x.ticks) {
      if (tickValues === undefined) {
        const n = Math.round(ticks + 1);
        tickValues = d3.range(n).map(i => d3.quantile(color.domain(), i / (n - 1)));
      }
      if (typeof tickFormat !== "function") {
        tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
      }
    }
  }

  // Threshold
  else if (color.invertExtent) {
    const thresholds
        = color.thresholds ? color.thresholds() // scaleQuantize
        : color.quantiles ? color.quantiles() // scaleQuantile
        : color.domain(); // scaleThreshold

    const thresholdFormat
        = tickFormat === undefined ? d => d
        : typeof tickFormat === "string" ? d3.format(tickFormat)
        : tickFormat;

    x = d3.scaleLinear()
        .domain([-1, color.range().length - 1])
        .rangeRound([marginLeft, width - marginRight]);

    svg.append("g")
      .selectAll("rect")
      .data(color.range())
      .join("rect")
        .attr("x", (d, i) => x(i - 1))
        .attr("y", marginTop)
        .attr("width", (d, i) => x(i) - x(i - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", d => d);

    tickValues = d3.range(thresholds.length);
    tickFormat = i => thresholdFormat(thresholds[i], i);
  }

  // Ordinal
  else {
    x = d3.scaleBand()
        .domain(color.domain())
        .rangeRound([marginLeft, width - marginRight]);

    svg.append("g")
      .selectAll("rect")
      .data(color.domain())
      .join("rect")
        .attr("x", x)
        .attr("y", marginTop)
        .attr("width", Math.max(0, x.bandwidth() - 1))
        .attr("height", height - marginTop - marginBottom)
        .attr("fill", color);

    tickAdjust = () => {};
  }

  svg.append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x)
      .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
      .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
      .tickSize(tickSize)
      .tickValues(tickValues))
    .call(tickAdjust)
    .call(g => g.select(".domain").remove())
    .call(g => g.append("text")
      .attr("x", marginLeft)
      .attr("y", marginTop + marginBottom - height - 6)
      .attr("fill", "currentColor")
      .attr("text-anchor", "start")
      .attr("font-weight", "bold")
      .text(title));

  return svg.node();
}

function ramp(color, n = 256) {
  const canvas = d3.create('canvas')
    .attr('width', n)
    .attr('height', 1)
    .attr('id', 'legCanvEl')

  const context = canvas.node().getContext("2d");
  for (let i = 0; i < n; ++i) {
    context.fillStyle = color(i / (n - 1));
    context.fillRect(i, 0, 1, 1);
  }
  return canvas.node();
}

//---------------------------------------------------------
// DATA

async function getData() {
  // const storyData = await d3.csv('https://docs.google.com/spreadsheets/d/e/2PACX-1vR4UIxGqH_c3RXWB20CMVvvYlCjWrSiXUB67Cr_0ZyuvYqV-ptD8OUxGSq5MWnZZvyN1u_6J716d0Si/pub?output=csv')
  
  const storyData = await d3.json('./data/story.json')

  const chapters = storyData.map((d, i) => {
    return {
    id: i,
    title: d.title,
    headline: d.headline,
    image: d.photoUrl,
    alignment: d.alignment,
    description: d.content,
    date: d.date
    // onChapterEnter: layerFormat(d.onLayerEnter),
    // onChapterExit: layerFormat(d.onLayerExit),
    // onChapterEnter: Object.entries(d).splice(17).map(d => ({ "layer": d[0], "opacity": !d[1] ? 0 : Number(d[1])}))
  }
  })
  config.chapters = chapters

  ///////////////////// CHAPTERS vvv


  const alignments = {
    'left': 'lefty',
    'center': 'centered',
    'right': 'righty',
    'full': 'fully'
  }

  const story = document.getElementById('story');

  const storyFeatures = document.createElement('div');
			storyFeatures.setAttribute('id', 'storyFeatures');

			const header = document.createElement('div');

			if (config.title) {
				const titleText = document.createElement('h1');
				titleText.innerText = config.title;
				header.appendChild(titleText);
			}

			if (config.subtitle) {
				const subtitleText = document.createElement('h2');
				subtitleText.innerText = config.subtitle;
				header.appendChild(subtitleText);
			}

			if (config.headline) {
				const headlineText = document.createElement('h2');
				headlineText.innerText = config.headline;
				header.appendChild(headlineText);
			}

			if (config.byline) {
				const bylineText = document.createElement('p');
				bylineText.innerText = config.byline;
				header.appendChild(bylineText);
			}

			if (header.innerText.length > 0) {
				header.classList.add(config.theme);
				header.setAttribute('id', 'header');
				story.appendChild(header);
			}

			config.chapters.forEach((record, idx) => {
				const container = document.createElement('div');
				const chapter = document.createElement('div');

				if (record.title) {
					const title = document.createElement('h3');
					title.innerText = record.title;
					chapter.appendChild(title);
				}

				if (record.headline) {
					const headline = document.createElement('h4');
					headline.innerText = record.headline;
					chapter.appendChild(headline);
				}

				if (record.image) {
					const image = new Image();
					image.src = record.image;
					chapter.appendChild(image);
				}

				if (record.description) {
					const story = document.createElement('p');
					story.innerHTML = record.description;
					chapter.appendChild(story);
				}

				container.setAttribute('id', record.id);
				container.classList.add('step');
				if (idx === 0) {
					container.classList.add('active-chapter');
				}

				chapter.classList.add(config.theme);
				container.appendChild(chapter);
				container.classList.add(alignments[record.alignment] || 'centered');
				if (record.hidden) {
					container.classList.add('hidden');
				}
				storyFeatures.appendChild(container);
			});

			story.appendChild(storyFeatures);

			const footer = document.createElement('div');

			if (config.footer) {
				const footerText = document.createElement('p');
				footerText.innerHTML = config.footer;
				footer.appendChild(footerText).setAttribute('style', 'padding-right: 40px; padding-left: 40px;');
			}

			if (footer.innerText.length > 0) {
				footer.classList.add(config.theme);
				footer.setAttribute('id', 'footer');
				story.appendChild(footer);
			}
  
  ///////////////////// CHAPTERS ^^^

  const us = await d3.json('./data/us.json')

  const usStates = topojson.feature(us, us.objects.states)
  const projection = d3.geoAlbersUsa().fitExtent([[0, mapMargin.top], [mapWidth, mapHeight]], usStates)
  const path = d3.geoPath().projection(projection)

  mapSvg.append('path')
    .datum(topojson.mesh(us, us.objects.states))
    .attr('stroke', '#aaa')
    .attr('fill', 'none')
    .attr('d', path)
    .attr('stroke-linejoin', 'round');


    // TO GET NEW DATA: curl -LJO https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv
    const rawCountiesUnfiltered = await d3.csv('./data/us-counties.csv')
    // const rawStatesUnfiltered = await d3.csv('./data/states-nyt-data.csv')
  
    // const rawCountiesUnfiltered = await d3.csv('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv')
    // const rawStatesUnfiltered = await d3.csv('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv')
  
  const statePop = await d3.csv('./data/statePop.csv')
  const countyPopUglyFips = await d3.csv('./data/countyPopUglyFips.csv')

  // console.log('rawCountiesUnfiltered', rawCountiesUnfiltered)
  // console.log('rawStatesUnfiltered', rawStatesUnfiltered)

  // //------------------------------------------------------
  // // MAP DATA

  us.objects.counties.geometries.forEach(d => {
    let str = d.id.toString()
    d.id = str.length === 4 ? '0'.concat(str) : str
  })

  // //------------------------------------------------------
  // // COVID DATA

  // // // COVID DATA FUNCTIONS & HELPER VARIABLES

  const features = new Map(topojson.feature(us, us.objects.counties).features.map(d => [d.id, d]))

  const id = d => d.fips || `${d.county}, ${d.state}`

  function position({ fips, state, county }) {
    if (!fips)
      switch (`${county}, ${state}`) {
        case 'New York City, New York':
          return projection([-74.0060, 40.7128]);
        case 'Kansas City, Missouri':
          return projection([-94.5786, 39.0997]);
        case 'Joplin, Missouri':
          return projection([-94.5133, 37.0842]);
      }
    const feature = features.get(fips);
    return feature && path.centroid(feature);
  }

  const processData = data => {
    const tempArr = Array.from(new Array(avgNum), d => 0);
    const returnMap = new Map();
  
    data.forEach((d, i) => {
      const newCases = Math.max(
        d.cases - (data[i - 1] ? data[i - 1].cases : 0),
        0
      );
  
      tempArr.push(newCases);
      if (tempArr.length > avgNum) tempArr.shift();
      const sma = d3.mean(tempArr);
      const smaRound = Math.round(sma);
  
      const popPerHundThou = data[0].county
        ? countiesPop.get(id(d)) / 100000
        : statesPop.get(d.fips) / 100000;
        // ? countiesPop.get(id(d)) / 10000
        // : statesPop.get(d.fips) / 10000;
  
      const perHundThou = smaRound / popPerHundThou;
  
      returnMap.set(d.date, {
        newCases: newCases,
        sma: sma,
        smaRound: smaRound,
        perHundThou: perHundThou
      });
    });
  
    return returnMap;
  }

  // // // COVID DATA TRANSFORMATIONS

  // const rawStates = rawStatesUnfiltered.filter(d => {
  //   if (d.state === 'District of Columbia') d.state = 'D.C.'
  //   return !excludedStates.includes(d.fips)
  // })

  const rawCounties = rawCountiesUnfiltered.filter(d => !excludedStates.includes(d.fips.slice(0, 2)))
  
  // const states = Array.from(d3.group(rawStates, d => d.state).keys())
  const countyPositions = new Map(
    d3.groups(rawCounties, id)
    .map(([id, [d]]) => [id, position(d)])
    .filter(([, position]) => position)
  )

  // const dates = Array.from(d3.group(rawStates, d => d.date).keys())
  const dates = Array.from(d3.group(rawCounties, d => d.date).keys())

  // //------------------------------------------------------
  // // POPULATION DATA

  const statesPop = new Map(
    statePop.map(d => [d3.format('02')(d.STATE), +d.POPESTIMATE2019])
  )

  const cityCounties = [
    {
      STATE: "36",
      COUNTY: null,
      STNAME: "New York",
      CTYNAME: "New York City",
      POPESTIMATE2019: "8336817",
      FIPS: null
    },
    {
      STATE: "29",
      COUNTY: null,
      STNAME: "Missouri",
      CTYNAME: "Kansas City",
      POPESTIMATE2019: "459787",
      FIPS: null
    },
    {
      STATE: "29",
      COUNTY: null,
      STNAME: "Missouri",
      CTYNAME: "Joplin",
      POPESTIMATE2019: "50150",
      FIPS: null
    }
  ]

  const nycAreaCodes = ["36061", "36047", "36081", "36005", "36085"]

  const countyPop = countyPopUglyFips.map(d => {
    d.STATE = d3.format("02")(d.STATE);
    d.COUNTY = d3.format("03")(d.COUNTY);
    d.FIPS = d.STATE.concat(d.COUNTY);
    return d;
  })
  .filter(d => d.COUNTY != '000' && !nycAreaCodes.includes(d.FIPS))
  .concat(cityCounties)

  const popId = d => d.FIPS || `${d.CTYNAME}, ${d.STNAME}`

  const countiesPop = new Map(countyPop.map(d => [popId(d), +d.POPESTIMATE2019]))

  // //------------------------------------------------------
  // // FRAMES DATA

  // const statesByPlace = d3.rollup(rawStates, v => processData(v), d => d.state)
  const countiesByPlace = d3.rollup(rawCounties, v => processData(v), d => id(d))
  
  const frames = dates.map(date => ({
    date: date,
  
    // states: new Map(
    //   states.map(state => [
    //     state,
    //     statesByPlace.get(state).get(date) || {
    //       newCases: 0,
    //       sma: 0,
    //       smaRound: 0,
    //       perHundThou: 0
    //     }
    //   ])
    // ),
  
    counties: Array.from(countyPositions, ([key, value]) => key).map(county => [
      county,
      countiesByPlace.get(county).get(date)
        ? countiesByPlace.get(county).get(date)['smaRound']
        : 0,
      countiesByPlace.get(county).get(date)
        ? countiesByPlace.get(county).get(date)['perHundThou']
        : 0
    ])
  }))
  
  const maxDailyCasesCountiesObj = getMaxDailyCasesCounties()
  const maxDailyCasesCounties = maxDailyCasesCountiesObj.max
  function getMaxDailyCasesCounties() {
    let max = 0;
    let theDate
    const obj = {}
    for (let date of frames) {
      const maxOfDay = d3.max(date.counties.map(d => d[1]));
      if (maxOfDay > max) {
        max = maxOfDay
        theDate = date.date
      };
    }
    obj.max = max
    obj.date = theDate
    // return max;
    return obj;
  }

  // console.log('maxDailyCasesCounties', maxDailyCasesCounties)

  const maxPerHundThouCounties = getMaxPerHundThouCounties()
  function getMaxPerHundThouCounties() {
    let max = 0;
    for (let date of frames) {
      const maxOfDay = d3.max(date.counties.map(d => d[2]));
      if (maxOfDay > max) max = maxOfDay;
      // if (maxOfDay > 250)
        // console.log(
        //   // date.date,
        //   // 'county: ' +
        //   //   date.counties[d3.maxIndex(date.counties.map(d => d[2]))][0],
        //   // 'state: ' +
        //   // fipsToStateLookup.get(
        //   //   date.counties[d3.maxIndex(date.counties.map(d => d[2]))][0].slice(
        //   //     0,
        //   //     2
        //   //   )
        //   // ),
        //   // 'cases: ' + date.counties[d3.maxIndex(date.counties.map(d => d[2]))][1],
        //   // 'pop: ' +
        //   countiesPop.get(
        //     date.counties[d3.maxIndex(date.counties.map(d => d[2]))][0]
        //   )
        //   // maxOfDay
        // );
    }
    return max;
  }

  console.log('maxPerHundThouCounties', maxPerHundThouCounties)
  console.log('maxDailyCasesCountiesObj', maxDailyCasesCountiesObj)

  const length = d3.scaleLinear()
    .domain([0, maxDailyCasesCounties])
    .range([0, spikeMax])

  const interpolator = d3.piecewise(d3.interpolateHsl, ['#0400ff', '#ff0000', '#ff5900', '#ffb300', '#ffff00'])
  const color = d3.scaleSequential(interpolator)
    .domain([0, maxPerHundThouCounties])
    .clamp(true)
    .nice()

  legend({
    color: color,
    title: "New Cases Per 100,000 People",
    // title: "New Cases Per 10,000 People",
    width: mapWidth / 1.8,
    marginLeft: 15,
    marginRight: 15
  })

  // //------------------------------------------------------
  // // DATA: RANKING
  
  // function rank(value) {
  //   const data = Array.from(states, state => ({ state, value: value(state) }));
  //   data.sort((a, b) => {
  //     const aVal = a.value ? a.value.smaRound : 0;
  //     const bVal = b.value ? b.value.smaRound : 0;
  //     return d3.descending(aVal, bVal);
  //   });
  //   for (let i = 0; i < data.length; ++i) data[i].rank = i;
  //   return data;
  // }

  // const protoKeyFrames = frames.map(frame => {
  //   frame.statesRanked = rank(state => frame.states.get(state));
  //   return frame;
  // })
  // const keyFrames = protoKeyFrames

  const keyFrames = frames
  const prevKF = new Map(d3.pairs(keyFrames, (a, b) => [b, a]))
  
  // const nameFrames = d3.groups(keyFrames.flatMap(data => data.statesRanked), d => d.state)
  // prev = new Map(nameFrames.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a])))
  // next = new Map(nameFrames.flatMap(([, data]) => d3.pairs(data)))

  // ------------------------------------------------------
  // DRAWING
  // //------------------------------------------------------

  d3.select('#scrubInput')
    .attr('max', keyFrames.length - 1)
    .style('width', () => `${mapWidth / 4}px`)

  // // DRAWING: DATE DIVS
  
  const dateContainer = d3.select('#story')
    .append('div')
    .attr('id', 'dateContainer')
    .style('position', 'absolute')
    .style('top', window.innerHeight)
    .style('opacity', 0.0)

  const dateDivs = dateContainer.selectAll('.dateDiv')
    .data(keyFrames)
    .join('div')
    .attr('class', 'dateDiv')
    .attr('id', (d, i) => i)
    .attr('height', 10)
    .attr('width', 20)
    .style('padding', '50px')
    .text(d => d.date)

  const steps = d3.selectAll('.step')
    .data(chapters)
    .call(div => {
      div.filter(d => d.id != 0)
        .style('position', 'absolute')
        .style('top', (d, i) => {
          const div = dateDivs.nodes().find(div => div.innerHTML === d.date)
          if (div) return `${div.getBoundingClientRect().top}px`
          return '24998px'
        })
    })

  d3.select('#footer')
    .style('position', 'absolute')
    .style('top', '12998px')


  // //------------------------------------------------------
  // // DRAWING: SPIKES

  const draw = frame => {
    ctx.clearRect(0, 0, mapWidth, mapHeight);
    frame.counties.forEach((d, i) => {
      const xPos = countyPositions.get(d[0])[0];
      const yPos = countyPositions.get(d[0])[1];
      ctx.beginPath();
      ctx.moveTo(xPos - spikeWidth / 2, yPos);
      ctx.lineTo(xPos + spikeWidth / 2, yPos);
      ctx.lineTo(xPos, yPos - length(d[3]));
      ctx.closePath();
      ctx.fillStyle = color(d[2]).split(')')[0] + `, ${opacity})`;
      ctx.fill();
    });
  }

  // const update = frame => {
  //   try {
  //     const prevCounties = prevKF.get(frame).counties;
  //     const timer = d3.timer(elapsed => {
  //       const t = Math.min(1, d3.easeLinear(elapsed / duration));
  //       // const t = Math.min(1, dateProgress);
  //       frame.counties.forEach((d, i) => {
  //         const tweenCount = prevCounties[i][1] * (1 - t) + d[1] * t;
  //         d.splice(3, 1, tweenCount);
  //       });
  //       draw(frame);
  //       if (t === 1) timer.stop();
  //     });
  //   } catch {
  //     frame.counties.forEach(d => d.splice(3, 1, d[1]));
  //   }
  // }

  const updateSpikes = (frame, t) => {
    try {
      const prevCounties = prevKF.get(frame).counties || frame.counties
      frame.counties.forEach((d, i) => {
        const tweenCount = prevCounties[i][1] * (1 - t) + d[1] * t;
        d.splice(3, 1, tweenCount);
      });
      draw(frame);
    } catch {
      frame.counties.forEach(d => d.splice(3, 1, d[1]));
    }
  }

  // //------------------------------------------------------
  // // DRAWING: SPIKE LEGEND
  
  const makeSpike = length => `M${-spikeWidth / 2},0L0,${-length}L${spikeWidth / 2},0`

  const spikeLegend = mapSvg.append('g')
    .attr('class', 'spikeLegend')
    .attr('text-anchor', 'middle')
    .attr('font-size', 10)

  const spikeLegendGs = spikeLegend.selectAll('g')
    .data(length.ticks(4).slice(1).reverse())
   .join('g')
    .attr('transform', (d, i) => `translate(${mapWidth + 7 - (i + 1) * 15},${mapHeight - 13})`)

  spikeLegendGs.append('path')
    .style('opacity', opacity)
    .attr('d', d => makeSpike(length(d)))

  spikeLegendGs.append('text')
    .attr('dy', '1.1em')
    .text(length.tickFormat(4, "s"))

  const spikeLegendDescriptionWidth = spikeLegend.node().getBoundingClientRect().width

  spikeLegend.append('text')
    .attr('dy', '1.1em')
    .attr('text-anchor', 'end')
    .attr("font-weight", "bold")
    .attr('transform', `translate(${mapWidth - spikeLegendDescriptionWidth - 5},${mapHeight - 13})`)
    .text('New Cases')

  //------------------------------------------------------
  // BARS
  // //------------------------------------------------------
  // // BARS: FUNCTIONS

  // const margin = { top: 10, right: 50, bottom: 0, left: 100 }

  // const x = d3.scaleLinear()
  //   .domain([0, 1])
  //   .range([margin.left, width - margin.right])

  // const y = d3.scaleBand()
  //   .domain(d3.range(states.length))
  //   .rangeRound([margin.top, height - margin.top - margin.bottom])
  //   .padding(0.1)

  // const xAxis = d3
  //   .axisTop(x)
  //   .tickSizeOuter(0)
  //   .tickSizeInner(-height + margin.top + margin.bottom)

  // const axis = svg => {
  //   const g = svg.append('g').attr('transform', `translate(0,${margin.top})`);
  
  //   return (_, transition, largestBarVal) => {
  //     const min = Math.floor(largestBarVal);
  //     const max = width / 160;
  //     xAxis.ticks(min > max ? max : min);
  
  //     g.transition(transition).call(xAxis);
  //     g.selectAll('.tick line').attr('stroke', 'white');
  //     g.select('.domain').remove();
  //   };
  // }

  // const labels = svg => {
  //   let label = svg
  //     .append('g')
  //     .style("font", "bold 12px var(--sans-serif)")
  //     .style("font-variant-numeric", "tabular-nums")
  //     .attr('text-anchor', 'end')
  //     .selectAll('text');
  
  //   return (data, transition) =>
  //     (label = label
  //       .data(data.statesRanked, d => d.state)
  //       .join(
  //         enter =>
  //           enter
  //             .append('text')
  //             // change
  //             .attr('transform', d => `translate(${(x(0), y(d.rank))})`)
  //             .attr('y', y.bandwidth() / 2)
  //             .attr('x', -4)
  //             .attr('dy', '0.25em')
  //             // .attr('text-anchor', 'end')
  //             .style('opacity', 0)
  //             .text(d => d.state),
  //         update => update,
  //         exit => exit.transition(transition).remove()
  //       )
  //       .call(label =>
  //         label
  //           .transition(transition)
  //           .attr(
  //             'transform',
  //             d =>
  //               `translate(${d.value ? x(d.value.smaRound) : x(0)}, ${y(d.rank)})`
  //           )
  //           .style('opacity', d => (d.value.smaRound === 0 ? 0 : 1))
  //       ));
  // }

  // const values = svg => {
  //   let value = svg
  //     .append('g')
  //     .style("font", "12px var(--sans-serif)")
  //     .style("font-variant-numeric", "tabular-nums")
  //     .attr('text-anchor', 'start')
  //     .selectAll('text');
  
  //   return (data, transition) =>
  //     (value = value
  //       .data(data.statesRanked, d => d.state)
  //       .join(
  //         enter =>
  //           enter
  //             .append('text')
  //             // change
  //             .attr('transform', d => `translate(${(x(0), y(d.rank))})`)
  //             .attr('y', y.bandwidth() / 2)
  //             .attr('x', 3)
  //             .attr('dy', '0.25em')
  //             .style('opacity', 0)
  //             .text(d => (d.value ? d.value.smaRound : 0)),
  //         update => update,
  //         exit => exit.transition(transition).remove()
  //       )
  //       .call(value => {
  //         return value
  //           .transition(transition)
  //           .attr(
  //             'transform',
  //             d =>
  //               `translate(${d.value ? x(d.value.smaRound) : x(0)}, ${y(d.rank)})`
  //           )
  //           .style('opacity', d => (d.value.smaRound === 0 ? 0 : 1))
  //           .tween('text', d => {
  //             if (!prev.get(d) && d.value) return textTween(0, d.value.smaRound);
  //             return prev.get(d) && d.value
  //               ? !prev.get(d).value
  //                 ? textTween(0, d.value.smaRound)
  //                 : textTween(prev.get(d).value.smaRound, d.value.smaRound)
  //               : textTween(0, 0);
  //           });
  //       }));
  // }

  // function textTween(a, b) {
  //   const i = d3.interpolateNumber(a, b);
  //   return function(t) {
  //     this.textContent = formatNumber(i(t));
  //   };
  // }

  const formatDate = d3.utcFormat("%B %d, %Y")
  const parseDate = d3.timeParse("%Y-%m-%d")

  const ticker = svg => {
    const now = svg.append('g').append("text")
        // .attr("transform", `translate(${mapWidth * 0.677},${mapHeight - mapHeight / 30})`)
        .attr("transform", `translate(${mapWidth / 2},${mapMargin.top * 0.7})`)
        .style("font", `bold ${10}px var(--sans-serif)`)
        .style("font-variant-numeric", "tabular-nums")
        .style("text-anchor", "middle")
        .style("font-size", `${d3.min([mapWidth/22, 30])}px`)
        // .text(formatDate(parseDate(keyFrames[0].date)));
        .text('');

    return keyframe => now.text(formatDate(parseDate(keyframe.date)))
  }

  // const formatNumber = d3.format(",d")

  // const bars = svg => {
  //   let bar = svg
  //     .append('g')
  //     .attr('fill-opacity', 0.4)
  //     .selectAll('rect');
  
  //   return (data, transition) => {
  //     return (bar = bar
  //       .data(data.statesRanked, d => d.state)
  //       .join(
  //         enter =>
  //           enter
  //             .append("rect")
  //             // .attr("fill", color)
  //             .attr("height", y.bandwidth())
  //             .attr("x", x(0))
  //             // .attr("y", d => y((prev.get(d) || d).rank))
  //             .attr("y", d => y.range()[1])
  //             .attr("width", d => x((prev.get(d) || d).value.smaRound) - x(0)),
  //         update => update,
  //         exit =>
  //           exit
  //             .transition(transition)
  //             .remove()
  //             // .attr("y", d => y((next.get(d) || d).rank))
  //             .attr("y", d => y(d.rank))
  //             // .attr("width", d => x((next.get(d) || d).value) - x(0))
  //             .attr("width", d => x(d.value - x(0)))
  //       )
  //       .call(bar =>
  //         bar
  //           .transition(transition)
  //           .attr("y", d => y(d.rank))
  //           .attr("width", d => (d.value ? x(d.value.smaRound) - x(0) : 0))
  //           .attr('fill', d => color(d.value.perHundThou))
  //       ));
  //   };
  // }

  // //------------------------------------------------------
  // // BARS: DRAWING THINGS

  // const updateBars = bars(chartSvg);
  // const updateAxis = axis(chartSvg);
  // const updateLabels = labels(chartSvg);
  // const updateValues = values(chartSvg);
  const updateTicker = ticker(mapSvg);

  function scrub(keyframe) {
    // const transition = chartSvg.transition()
    //   // .duration(duration)
    //   .duration((d, i) => {
    //     console.log('d', d)
    //     console.log('i', i)
    //     return duration
    //   })
    //   .ease(d3.easeLinear)

    // const largestBarVal = d3.max([keyframe.statesRanked[0].value.smaRound, 1]);
    // x.domain([0, largestBarVal]);

    // updateAxis(keyframe, transition, largestBarVal);
    // updateBars(keyframe, transition);
    // updateLabels(keyframe, transition);
    // updateValues(keyframe, transition);
    updateTicker(keyframe);

    // update(keyframe)
    // updateSpikes(keyframe)
  }

  enterView({
    selector: '.step',
    enter: function(el) {
      // console.log(el)
      el.classList.add('active-chapter');
      const chapter = config.chapters.find(chap => chap.id == el.id);

    },
    progress: function(el, progress) {
      // ...
    },
    exit: function(el) {
      el.classList.remove('active-chapter');
      const chapter = config.chapters.find(chap => chap.id === el.id);
      const prevChapter = config.chapters.find(chap => chap.id === (Number(el.id) - 1).toString());
      // map[prevChapter.mapAnimation || 'flyTo'](ua.device.type === "Mobile" ? prevChapter.mLocation : prevChapter.location);
      
      // if (prevChapter.onChapterEnter.length > 0) prevChapter.onChapterEnter.forEach(setLayerOpacity)

    },
    // offset: ua.device.type === "Mobile" ? 0.45 : 0.6,
    offset: 0.4
  });

  enterView({
    selector: '.dateDiv',
    enter: function(el) {
      scrub(keyFrames[Number(el.id)])
    },
    progress: function(el, progress) {
      updateSpikes(keyFrames[Number(el.id)], progress)
    },
    exit: function(el) {
      scrub(keyFrames[Number(el.id - 1)])
    },
    // offset: ua.device.type === "Mobile" ? 0.45 : 0.6,
    offset: 0.4
  });
  

}

getData()