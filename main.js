//---------------------------------------------------------
// SETUP

console.log('diff:', window.outerHeight - window.innerHeight)
const ua = detect.parse(navigator.userAgent)
// const properHeight = window.innerHeight - 2 - 52
const properHeight = ua.device.type === "Mobile" ? window.innerHeight - 2 - 110 : window.innerHeight - 2

const vizContainer = d3.select('#viz-container')
  .style('height', `${properHeight}px`)
  .style('width', window.innerWidth - 2)

console.log('properHeight', properHeight)

// ------------------------------------------------------
// // MISCELLANEOUS VARIABLES SETUP

const start = performance.now()

const opacity = 0.7
const avgNum = 14
const duration = 225
const excludedStates = ["66", "69", "72", "78"]
const mapFill = '#0d0d0d'
const mapStroke = '#8d8d8d'
const defaultTextColor = '#fafafa'

const formatDate = d3.utcFormat("%B %d, %Y")
const parseDate = d3.timeParse("%Y-%m-%d")
const headerOffset = ua.device.type === "Mobile" ? 8 : 80
const marginOffset = 30

// ------------------------------------------------------
// // PAGE SETUP

const body = d3.select('body')
  .style('margin', '0 auto')
  .style('font-size', '12px')
  .style('overflow', 'auto')
  .style('background-color', '#171717')
  .style('color', 'white')

// console.log('width', d3.select('#viz-container').node().getBoundingClientRect().width)

const container = d3.select('#container')
  .style('position', 'relative')
  .style('margin', '0 auto')

console.log('container width:', container.node().getBoundingClientRect().width)

// ------------------------------------------------------
// // MAP SETUP

const mapContainer = d3.select('#map-container')

const macBounds = d3.select('#mapAndControls').node().getBoundingClientRect()

let mapWidth = macBounds.width
let mapHeight = macBounds.height

const justMapHeight = mapWidth / 1.7
// const justMapHeight = mapWidth / 1.9
// const mapMarginTop = macBounds.height - 50 - justMapHeight
// const mapMarginTop = ua.device.type === "Mobile" ? macBounds.height - 150 - justMapHeight : macBounds.height - 10 - justMapHeight
const mapMarginTop = macBounds.height - justMapHeight - 5
const mapMargin = {top: mapMarginTop, right: 45, bottom: 0, left: 0}
// const spikeMax = macBounds.height
const spikeMax = macBounds.height * 1.8
const spikeWidth = mapWidth / 90


// ------------------------------------------------------
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

// ------------------------------------------------------
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


// ------------------------------------------------------
// // MAP SVG SETUP

const mapSvg = mapContainer.append('svg').attr('class', 'mapSvg')
  // .attr('viewBox', `0 0 ${mapWidth}, ${mapHeight}`)
  .attr('width', mapWidth)
  .attr('height', mapHeight)

// ------------------------------------------------------
// // COLOR LEGEND SETUP

const colorLegendWidth = d3.min([mapWidth / 4, 320])
const colorLegendOffset = mapWidth - marginOffset - colorLegendWidth

function legend({
  color,
  title,
  tickSize = 6,
  width = colorLegendWidth,
  height = 44 + tickSize,
  marginTop = 18,
  marginRight = 0,
  marginBottom = 16 + tickSize,
  marginLeft = 0,
  ticks = width / 64,
  tickFormat,
  tickValues,
  xVal,
  yVal
} = {}) {

  const colorLegendG = mapSvg.append('g')
    .attr('transform', `translate(${xVal}, ${yVal})`)
    .attr('class', 'colorLegend hidden hideMe')

  let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
  let x;

  // Continuous
  if (color.interpolate) {
    const n = Math.min(color.domain().length, color.range().length);

    x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

    colorLegendG.append("image")
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

    colorLegendG.append("image")
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

    colorLegendG.append("g")
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

    colorLegendG.append("g")
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

  colorLegendG.append("g")
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
      .attr("fill", defaultTextColor)
      .attr("text-anchor", "start")
      .attr("font-weight", "bold")
      .text(title));

  return colorLegendG.node();
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

  const getDataStart = performance.now()
  console.log('beginning: ', getDataStart - start)

  const storyData = await d3.csv('https://docs.google.com/spreadsheets/d/e/2PACX-1vR4UIxGqH_c3RXWB20CMVvvYlCjWrSiXUB67Cr_0ZyuvYqV-ptD8OUxGSq5MWnZZvyN1u_6J716d0Si/pub?output=csv')
  // const storyData = await d3.csv('./data/chapters-Sheet1.csv')

  // console.log(storyData)

  const storyFetchEnd = performance.now()
  console.log('storyFetchEnd: ', storyFetchEnd - getDataStart)
  
  const chapters = storyData.map((d, i) => {
    return {
      id: i,
      title: d.title,
      headline: d.headline,
      image: d.photoUrl,
      alignment: d.alignment,
      description: d.content,
      date: d.date
    }
  })
  config.chapters = chapters

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
          title.classList.add(config.theme)
					title.innerText = record.title;
					chapter.appendChild(title);
				}

				if (record.headline) {
					const headline = document.createElement('h4');
          headline.classList.add(config.theme)
					headline.innerText = record.headline;
					chapter.appendChild(headline)
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
          d3.select(container)
            .classed('active-chapter', true)
            .classed('opening-title', true)
            .classed('introParas', true)
            .style('padding-bottom', 0)
				}
				if (idx === 1) {
          d3.select(container)
            .classed('intro', true)
            .classed('introParas', true)
            .style('padding-bottom', `${mapHeight * 0.6}px`)
            .style('opacity', 0.99)
				}

        d3.selectAll('.step').selectAll('div')
        .attr('class', 'storyDiv')
        .style('padding', ua.device.type === "Mobile" ? '25px 35px' : '25px 35px 25px 0px')

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
				footer.appendChild(footerText).setAttribute('style', 'padding-right: 40px; padding-left: 40px; padding-top: 500px;');
			}

			if (footer.innerText.length > 0) {
				footer.classList.add(config.theme);
				footer.setAttribute('id', 'footer');
				story.appendChild(footer);
			}
  
//---------------------------------------------------------
// // GEO DATA

  // EXPERIMENTS vvv
  const prePromiseAll = performance.now()
  console.log('before fetches: ', prePromiseAll - storyFetchEnd)

  const getCsv = (url) => d3.csv(url)
  const getJson = (url) => d3.json(url)

  const u = getJson('./data/us.json'),
    mdcco = getJson('./data/maxDailyCasesCountiesObj.json'),
    cpuf = getCsv('./data/countyPopUglyFips.csv'),
    
    ruc = getCsv('./data/us.csv'),
    rsuf = getCsv('./data/us-states.csv'),
    // rcuf = getCsv('./data/us-counties.csv')
    rcuf = getCsv('./data/jhuFlat.csv')

    // ruc = getCsv('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us.csv'),
    // rsuf = getCsv('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv'),
    // rcuf = getCsv('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv')
  
  // const [
  //   us,
  //   rawUsCases,
  //   maxDailyCasesCountiesObj,
  //   rawStatesUnfiltered,
  //   countyPopUglyFips
  // ] = await Promise.all([u, ruc, mdcco, rsuf, cpuf]);

  // ---------------------------
  // JHU EXPERIMENTS

  const jhuStart = performance.now()
  
  // const jhuRaw = await d3.csv('https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv')

  // const jhuRaw = await d3.csv('./data/time_series_covid19_confirmed_US.csv')
  
  const all = await d3.json('./data/all.json')

  console.log(all)
  console.log(all.us)
  console.log(all.jhu)
  
  // const maxDailyCasesCountiesObj = await d3.json('./data/maxDailyCasesCountiesObj.json')

  // const jhuMiddle = performance.now()

  // function processDataYa(data) {
  //   const dataFiltered = data.filter(
  //     (d) => d.FIPS.length > 5 || d.FIPS.length === 0
  //   );
  //   return dataFiltered.map((d) => {
  //     const split = d.FIPS.split(".");
  //     let fips = split[0];
  //     if (fips.length === 4) fips = "0".concat(fips);
  //     d.fips = fips;
  //     return d;
  //   });
  // }

  // const jhuProcessed = processDataYa(jhuRaw)

  // const rawCountiesUnfiltered = [];
  // // const rawCountiesUnfilteredDummy = [];
  // await jhuProcessed.forEach((d) => {
  //   for (const property in d) {
  //     const dateObj = d3.timeParse("%m/%d/%y")(property);
  //     if (dateObj)
  //       rawCountiesUnfiltered.push({
  //         fips: d.fips,
  //         date: d3.timeFormat("%Y-%m-%d")(dateObj),
  //         state: d.Province_State,
  //         county: d.Admin2,
  //         cases: d[property]
  //         // dateObj: dateObj
  //       });
  //   }
  // });

  d3.selectAll('.step').text('test 7')

  // console.log('commented out Promise.all')

  // const jhuEnd = performance.now()

  // console.log('rawCountiesUnfiltered', rawCountiesUnfiltered)
  // console.log('1st', jhuMiddle - jhuStart)
  // console.log('2nd', jhuEnd - jhuMiddle)

  // // console.log('rawUsCases', rawUsCases)
  // // console.log('rawStatesUnfiltered', rawStatesUnfiltered)
  // // console.log('rawCountiesUnfiltered', rawCountiesUnfiltered)

  // const postPromiseAll = performance.now()
  // console.log('after fetches: ', postPromiseAll - prePromiseAll)

  // const usStates = topojson.feature(us, us.objects.states)
  // const projection = d3.geoAlbersUsa().fitExtent([[0, mapMargin.top], [mapWidth - mapMargin.right, mapHeight]], usStates)
  // // const projection = d3.geoAlbersUsa().fitExtent([[0, mapMargin.top], [mapWidth, mapHeight]], usStates)
  // const path = d3.geoPath().projection(projection)

  // mapSvg.append('g')
  //   .attr('class', 'states')
  //   .selectAll('path')
  //  .data(usStates.features)
  //   .enter().append('path')
  //   .attr('stroke', mapStroke)
  //   .attr('fill', mapFill)
  //   .attr('class', d => `stateShape f${d.id} hidden`)
  //   .attr('d', path)

  // us.objects.counties.geometries.forEach(d => {
  //   let str = d.id.toString()
  //   d.id = str.length === 4 ? '0'.concat(str) : str
  // })

  // console.log('line 530')
  
//---------------------------------------------------------
// // US CASES DATA + DRAWING

//   rawUsCases.forEach(d => {
//     d.dateObj = parseDate(d.date),
//     d.cases = +d.cases,
//     // d.perCapita = +d.cases / (332403650 / 100000)
//     d.deaths = +d.deaths
//   })

//   const dates = Array.from(d3.group(rawUsCases, d => d.date).keys())

//   const processData = data => {
//     const tempArr = Array.from(new Array(avgNum), d => 0);
//     const returnMap = new Map();
  
//     data.forEach((d, i) => {
//       const newCases = Math.max(
//         d.cases - (data[i - 1] ? data[i - 1].cases : 0),
//         0
//       );
  
//       tempArr.push(newCases);
//       if (tempArr.length > avgNum) tempArr.shift();
//       const sma = d3.mean(tempArr);
//       const smaRound = Math.round(sma);

//       let popPerHundThou
//       let perHundThou
//       if (data[0].county) {
//         popPerHundThou = countiesPop.get(id(d)) / 100000
//         perHundThou = smaRound / popPerHundThou;
//       }
  
//       returnMap.set(d.date, {
//         newCases: newCases,
//         sma: sma,
//         smaRound: smaRound,
//         perHundThou: perHundThou
//       });
//     });
  
//     return returnMap;
//   }

//   const usCasesSma = Array.from(processData(rawUsCases))
  
//   usCasesSma.forEach(d => {
//     // d.smaPerCapita = 
//     d[1].perCapita = d[1].smaRound / (332403650 / 100000)
//     // return d
//   })

// //---------------------------------------------------------
// // // DATEDIVS EXPERIMENT


//   const dateContainer = d3.select('#story')
//     .append('div')
//     .attr('id', 'dateContainer')
//     .style('position', 'absolute')
//     .style('top', d => {
//       const openingTitleBounds = d3.select('.opening-title').node().getBoundingClientRect()
//       const introBounds = d3.select('.intro').node().getBoundingClientRect()
//       return `${openingTitleBounds.height + introBounds.height}px`
//     })

//   const frames = dates.map(d => ({date: d}))
//   console.log('frames1', frames[0])

//   const keyFrames = frames

//   const dateDivs = dateContainer.selectAll('.dateDiv')
//     .data(keyFrames)
//     .join('div')
//     .attr('class', 'dateDiv')
//     .attr('id', (d, i) => i)
//     .attr('height', 10)
//     .attr('width', 20)
//     .style('padding', '70px')
//     // .style('border', '1px solid pink')
//     // .style('opacity', 0.5)
//     .style('opacity', 0.0)
//     .text(d => d.date)

//   const stepSelection = d3.selectAll('.step')

//   stepSelection
//     .data(chapters)
//     .call(div => {
//       div.filter(d => d.id != 0 && d.id != 1)
//         .style('position', 'absolute')
//         .style('top', d => {
//           const div = dateDivs.nodes().find(div => div.innerHTML === d.date)
//           if (div != undefined) return `${window.pageYOffset + div.getBoundingClientRect().top}px`
//         })
//     })

//   d3.select('#footer')
//     .style('position', 'absolute')
//     .style('top', d => {
//       const div = dateDivs.nodes()[dateDivs.nodes().length - 1]
//       return `${window.pageYOffset + dateDivs.nodes()[dateDivs.nodes().length - 1].getBoundingClientRect().bottom}px`
//     })

// // ------------------------------------------------------
// // // DRAWING: TIMELINE

// const maxDailyCasesCounties = maxDailyCasesCountiesObj.max
// const maxPerHundThouCounties = maxDailyCasesCountiesObj.perCapita
// const colorCutoff = 400

//   const interpolator1 = d3.piecewise(d3.interpolateHsl, ['#fffff2', '#ff8800', '#ff0022'])
//   const color1 = d3.scaleSequential(interpolator1)
//     .domain([0, colorCutoff])
//     // .domain([0, maxPerHundThouCounties])
//     .clamp(true)
  
//   const interpolator2 = d3.interpolate(color1.range()[1], "rgb(108,99,255)")
//   const color2 = d3.scaleSequential(interpolator2)
//     .domain([colorCutoff, maxPerHundThouCounties])
//     .clamp(true)

//   const color = (val) => {
//     if (val <= colorCutoff) {
//       return color1(val)
//     } else {
//       // console.log('color2')
//       return color2(val)
//     }
//   }

//   const tlWidth = ua.device.type === "Mobile" ? mapWidth - marginOffset : mapWidth - colorLegendWidth - marginOffset
//   const tlHeight = 50
//   const tlMargin = {top: 5, right: 0, bottom: 5, left: 0}

//   const tlX = d3.scaleBand()
//     .domain(usCasesSma.map(d => d[0]))
//     .range([tlMargin.left, tlWidth - tlMargin.right])

//   const tlY = d3.scaleLinear()
//     .domain(d3.extent(usCasesSma.map(d => d[1].smaRound)))
//     .range([tlHeight - tlMargin.bottom, tlMargin.top])

//   const tlGroup = mapSvg.append('g')
//     .attr('class', 'tlBars hidden hideMe')
//     .attr('transform', `translate(${0},${ua.device.type === "Mobile" ? 50 + headerOffset : headerOffset})`)
//     // .attr('transform', `translate(${0},${ua.device.type === "Mobile" ? 50 : 0})`)

//   tlGroup
//     .selectAll('rect')
//   .data(usCasesSma)
//     .join('rect')
//     .attr('x', d => tlX(d[0]))
//     .attr('y', d => tlY(d[1].smaRound))
//     .attr('width', tlX.bandwidth())
//     .attr('height', d => tlY(0) - tlY(d[1].smaRound))
//     .attr('fill', d => color(d[1].perCapita))

//   // EXPLANATION...
//   const wrap_text_array = (text, max_width) => {
//     // split the text around spaces (to get individual words)
//     const words = text.split(/\s+/).reverse();
    
//     // define vars to hold individual words, lines, and all lines
//     let word,
//         lines = [ ],
//         line = [ ];
    
//     // add words to a line until we exceed the max_width (in characters)
//     // when we reach width, add the line to lines and start a new line
//     while (word = words.pop()) {
//       line.push(word);
//       if (line.join(" ").length > max_width) {
//         line.pop()
//         lines.push(line.join(" "));
//         line = [word];
//       }
//     }
//     lines.push(line.join(" "));
    
//     return lines;
//   }

//   const wrap_text_nchar = (text_element, max_width, line_height, unit = "em") => {
  
//     // use a default line_height if not provided
//     if (!line_height) line_height = 1.1;
    
//     // wrap the text based on how many characters per line
//     const text_array = wrap_text_array(text_element.text(), max_width);
    
//     // append a tspan element for each line of text_array
//     text_element.text(null)
//       .selectAll("tspan")
//       .data(text_array).enter()
//       .append("tspan")
//       .attr("x", text_element.attr("x"))
//       .attr("y", text_element.attr("y"))
//       .attr("dy", (d, i) => `${i * line_height}${unit}`)
//       .text(d => d);
//   }

//   const explanation = mapSvg.append('text')
//     .attr('x', tlX.range()[1] / 12)
//     .attr('y', ua.device.type === "Mobile" ? headerOffset + 120 : headerOffset + tlY(0) + 20)
//     .attr('class', 'hidden hideMe')
//     .style('font-family', 'helvetica')
//     .style('font-size', 10)
//     .style('fill', defaultTextColor)
//     .text(`Size (of bars, spikes) represents new cases. Color represents new cases per 100,000 people. Both values are based on a ${avgNum}-day rolling average.`)

//   explanation.each(function() { wrap_text_nchar(d3.select(this), mapWidth / 5) })
    
// // ------------------------------------------------------
// // DRAW FUNCTIONS

//   let vizHidden = true

//   const progBar = tlGroup.append('rect')
//     .attr('class', 'progress hidden')
//     .attr('x', 0)
//     .attr('y', 0)
//     .attr('width', 1)
//     .attr('height', tlHeight)
//     .style('fill', defaultTextColor)

//   const tickerText = mapSvg.append('g').append("text")
//     .attr('class', 'tickerText')
//     .attr("transform", ua.device.type === "Mobile" ? `translate(${(mapWidth / 2)},${headerOffset + 70})` : `translate(${(tlWidth / 2)},${headerOffset + 10})`)
//     .style("font", `bold ${10}px var(--sans-serif)`)
//     .style("font-variant-numeric", "tabular-nums")
//     .style("text-anchor", "middle")
//     .style("font-family", `helvetica`)
//     .style("font-weight", `100`)
//     .style("text-shadow", `0px 0px 2px #171717, 0px 0px 3px #171717, 0px 0px 3px #171717, 0px 0px 5px #171717, 0px 0px 5px #171717, 0px 0px 5px #171717, 0px 0px 5px #171717`)
//     .style("font-size", ua.device.type === 'Mobile' ? `${d3.min([mapWidth/22, 30])}px` : `${d3.min([mapWidth/27, 25])}px`)
//     .style('fill', defaultTextColor)
//     .text('');

//   const ticker = svg => {
//     return keyframe => keyframe !== undefined ? tickerText.text(formatDate(parseDate(keyframe.date))) : tickerText.text('')
//   }

//   const progress = svgEl => {
//     return keyframe => {
//       if (keyframe !== undefined) {
//         progBar.attr('x', () => tlX(keyframe.date))
//       }
//     }
//   }

//   const stateShapes = svg => {
//     return keyframe => {
//       if (keyframe !== undefined) {
//         vizHidden = false
//         d3.selectAll('.spikeLegend').classed('hidden', false)
//         d3.select('.colorLegend').classed('hidden', false)
//         d3.selectAll('.hideMe').classed('hidden', false)
//         d3.select('.progress').classed('hidden', false)
        
//         if (keyframe.statesCasesStarted)
//         keyframe.statesCasesStarted.forEach((val, key) => {
//           if (val) {
//             d3.select(`.f${fipsLookup[key]}.hidden`)
//               .classed('hidden', false)
//               .raise()
//               .attr('stroke', 'white')
//               .attr('fill', '#d8d8d8')
//               .transition().duration(600)
//               .attr('stroke', mapStroke)
//               .attr('fill', mapFill)

//           } else {
//             d3.select(`.f${fipsLookup[key]}`)
//               .classed('hidden', true)
//               .attr('stroke', 'none')
//               .attr('fill', 'none')
//           }
//         })
//       } else {
//         d3.selectAll('.stateShape').classed('hidden', true)
//         d3.select('.spikeLegend').classed('hidden', true)
//         d3.selectAll('.colorLegend').classed('hidden', true)
//         d3.selectAll('.hideMe').classed('hidden', true)
//         d3.select('.progress').classed('hidden', true)
//       }
//     }
//   }

// // ------------------------------------------------------
// // // UPDATE FUNCTIONS
// const updateStateShapes = stateShapes(mapSvg)
// const updateProgress = progress(tlGroup)
// const updateTicker = ticker(mapSvg)

//   // let prevCounties
//   const updateSpikes = (frame, t) => {
//     try {
//       const prevCounties = prevKF.get(frame).counties || frame.counties
//       frame.counties.forEach((d, i) => {
//         const tweenCount = prevCounties[i][1] * (1 - t) + d[1] * t;
//         d.splice(3, 1, tweenCount);
//       });
//       draw(frame);
//     } catch {
//       if (frame.counties)
//       frame.counties.forEach(d => d.splice(3, 1, d[1]));
//     }
//   }
  
//   let allowEnterExit = true
//   let allowProgress = true
//   let terminalFrameId = null

//   function handleScroll(elId) {
//     if (allowEnterExit) {
//       // d3.select(el).style('opacity', 0.5)
//       allowEnterExit = false
//       allowProgress = true
//       const frame = keyFrames[Number(elId)]
//       scrub(frame)
//       setTimeout(() => {
//         allowEnterExit = true
//         if (terminalFrameId) {
//           scrub(keyFrames[Number(terminalFrameId)])
//           updateSpikes(frame, 0)
//         }
//         terminalFrameId = null
//       }, 2)
//     } else {
//       allowProgress = false
//       terminalFrameId = elId
//     }
//   }

//   enterView({
//     selector: '.dateDiv',
//     enter: function(el) {
//       handleScroll(el.id)
//     },
//     progress: function(el, progress) {
//       if (allowProgress) updateSpikes(keyFrames[Number(el.id)], progress)
//     },
//     exit: function(el) {
//       handleScroll(el.id - 1)
//     },
//     // offset: ua.device.type === "Mobile" ? 0.45 : 0.6,
//     offset: 0.4
//   })

//   enterView({
//     selector: '.step',
//     enter: function(el) {
//       el.classList.add('active-chapter');
//       const chapter = config.chapters.find(chap => chap.id == el.id);
//     },
//     progress: function(el, progress) {
//     },
//     exit: function(el) {
//       el.classList.remove('active-chapter');
//       const chapter = config.chapters.find(chap => chap.id === el.id);
//       const prevChapter = config.chapters.find(chap => chap.id === (Number(el.id) - 1).toString());
//       // map[prevChapter.mapAnimation || 'flyTo'](ua.device.type === "Mobile" ? prevChapter.mLocation : prevChapter.location);
//       // if (prevChapter.onChapterEnter.length > 0) prevChapter.onChapterEnter.forEach(setLayerOpacity)
//     },
//     // offset: ua.device.type === "Mobile" ? 0.45 : 0.6,
//     offset: 0.4
//   });

//   enterView({
//     selector: '.introParas',
//     enter: function(el) {
//     },
//     progress: function(el, progress) {
//       if (!vizHidden) {
//         vizHidden = true
//         d3.selectAll('.stateShape').classed('hidden', true)
//         d3.select('.spikeLegend').classed('hidden', true)
//         d3.select('.colorLegend').classed('hidden', true)
//         d3.selectAll('.hideMe').classed('hidden', true)
//         d3.select('.progress').classed('hidden', true)
//         d3.select('.tickerText').text('')
//       }
//     },
//     exit: function(el) {
//     },
//     // offset: ua.device.type === "Mobile" ? 0.45 : 0.6,
//     offset: 0.4
//   });

//   // // // COVID DATA FUNCTIONS & HELPER VARIABLES

//   const features = new Map(topojson.feature(us, us.objects.counties).features.map(d => [d.id, d]))

//   const id = d => d.fips || `${d.county}, ${d.state}`

//   function position({ fips, state, county }) {
//     if (!fips)
//       switch (`${county}, ${state}`) {
//         case 'New York City, New York':
//           return projection([-74.0060, 40.7128]);
//         case 'Kansas City, Missouri':
//           return projection([-94.5786, 39.0997]);
//         case 'Joplin, Missouri':
//           return projection([-94.5133, 37.0842]);
//       }
//     const feature = features.get(fips);
//     return feature && path.centroid(feature);
//   }

//   // // // COVID DATA TRANSFORMATIONS

//   const rawStates = rawStatesUnfiltered.filter(d => {
//     if (d.state === 'District of Columbia') d.state = 'D.C.'
//     return !excludedStates.includes(d.fips)
//   })

//   const rawCounties = rawCountiesUnfiltered.filter(d => !excludedStates.includes(d.fips.slice(0, 2)))
  
//   const statesList = Array.from(d3.group(rawStates, d => d.state).keys())
//   const countyPositions = new Map(
//     d3.groups(rawCounties, id)
//     .map(([id, [d]]) => [id, position(d)])
//     .filter(([, position]) => position)
//   )

//   const removeFirstZero = str => str[0] === '0' ? str.substring(1, 2) : str

//   const fipsLookup = {}
//   d3.groups(rawStates, d => d.state, d => d.fips)
//     .map(x => { return {[x[0]]: x[1][0][0]} })
//     .forEach(d => {
//       fipsLookup[Object.keys(d)[0]] = removeFirstZero(Object.values(d)[0])
//     })

//   // ------------------------------------------------------
//   // // POPULATION DATA

//   const cityCounties = [
//     {
//       STATE: "36",
//       COUNTY: null,
//       STNAME: "New York",
//       CTYNAME: "New York City",
//       POPESTIMATE2019: "8336817",
//       FIPS: null
//     },
//     {
//       STATE: "29",
//       COUNTY: null,
//       STNAME: "Missouri",
//       CTYNAME: "Kansas City",
//       POPESTIMATE2019: "459787",
//       FIPS: null
//     },
//     {
//       STATE: "29",
//       COUNTY: null,
//       STNAME: "Missouri",
//       CTYNAME: "Joplin",
//       POPESTIMATE2019: "50150",
//       FIPS: null
//     }
//   ]

//   const nycAreaCodes = ["36061", "36047", "36081", "36005", "36085"]

//   const countyPop = countyPopUglyFips.map(d => {
//     d.STATE = d3.format("02")(d.STATE);
//     d.COUNTY = d3.format("03")(d.COUNTY);
//     d.FIPS = d.STATE.concat(d.COUNTY);
//     return d;
//   })
//   .filter(d => d.COUNTY != '000' && !nycAreaCodes.includes(d.FIPS))
//   .concat(cityCounties)

//   const popId = d => d.FIPS || `${d.CTYNAME}, ${d.STNAME}`

//   const countiesPop = new Map(countyPop.map(d => [popId(d), +d.POPESTIMATE2019]))

//   // ------------------------------------------------------
//   // // FRAMES DATA

//   const statesByPlace = d3.rollup(rawStates, v => processData(v), d => d.state)
//   const countiesByPlace = d3.rollup(rawCounties, v => processData(v), d => id(d))

  // NOT WORKING WITH STUFF COMMENTED PAST HERE

  // let statesMap = new Map(
  //   statesList.map(state => [
  //     state,
  //     0
  //   ])
  // )

  // frames.forEach(d => {
  //   d.statesCasesStarted = new Map(statesList.map(state => {
  //     const obj = statesByPlace.get(state).get(d.date)
  //     if (obj) if (obj.newCases > 0) statesMap.set(state, 1)
  //     return [
  //       state,
  //       statesMap.get(state)
  //     ]
  //   }))
  
  //   d.counties = Array.from(countyPositions, ([key, value]) => key).map(county => [
  //     county,
  //     countiesByPlace.get(county).get(d.date)
  //       ? countiesByPlace.get(county).get(d.date)['smaRound']
  //       : 0,
  //     countiesByPlace.get(county).get(d.date)
  //       ? countiesByPlace.get(county).get(d.date)['perHundThou']
  //       : 0
  //   ])
  // })

  // console.log('frames2', frames[0])

  // // TO REFRESH maxDailyCasesCountiesObj UNCOMMENT CODE BELOW AND SAVE CONSOLE LOG
  // const maxDailyCasesCountiesObjSave = getMaxDailyCasesCounties()
  // console.log('maxDailyCasesCountiesObjSave', maxDailyCasesCountiesObjSave)
  
  // // const maxDailyCasesCounties = maxDailyCasesCountiesObj.max
  // // const maxPerHundThouCounties = maxDailyCasesCountiesObj.perCapita

  // function getMaxDailyCasesCounties() {
  //   let max = 0
  //   let theDate
  //   let perCapita = 0
  //   let perCapitaDate
  //   const obj = {}
  //   for (let date of frames) {
  //     const maxOfDay = d3.max(date.counties.map(d => d[1]));
  //     if (maxOfDay > max) {
  //       max = maxOfDay
  //       theDate = date.date
  //     }

  //     const maxPerCapitaOfDay = d3.max(date.counties.map(d => d[2]));
  //     if (maxPerCapitaOfDay > perCapita) {
  //       perCapita = maxPerCapitaOfDay
  //       perCapitaDate = date.date
  //     }
  //   }
  //   obj.max = max
  //   obj.maxDate = theDate
  //   obj.perCapita = perCapita
  //   obj.perCapitaDate = perCapitaDate
  //   return obj
  // }

  // const length = d3.scaleLinear()
  //   .domain([0, maxDailyCasesCounties])
  //   .range([0, spikeMax])

  // // const interpolator = d3.piecewise(d3.interpolateHsl, ['#0400ff', '#ff0000', '#ff5900', '#ffb300', '#ffff00'])
  // // // const interpolator = d3.piecewise(d3.interpolateHsl, ['#0400ff', '#ffff00'])
  // // const color = d3.scaleSequential(interpolator)
  // //   .domain([0, maxPerHundThouCounties])
  // //   .clamp(true)
  // //   .nice()

  // const lengthOfInterest = length.invert(spikeWidth / 2)
  
  // function findLegendMax() {
  //   let i = 550
  //   let arr = testMaxes(i)
  //   if (arr.length === 0) {
  //     while (arr.length === 0) {
  //       i -= 10
  //       arr = testMaxes(i)
  //     }
  //     return i
  //   }
  //   while (arr.length > 0) {
  //     i += 10
  //     arr = testMaxes(i)
  //   }
  //   return i
  // }
  // function testMaxes(num) {
  //   let arr = []
  //   for (let date of frames) {
  //     date.counties.forEach(d => {
  //       if (d[2] > num && d[1] > lengthOfInterest) {
  //         return arr.push(d)
  //       }
  //     })
  //   }
  //   return arr;
  // }

  // // const legendMax = findLegendMax()
  // const legendMax = 1000
  // const maxColor = color(legendMax)
  // // console.log('legendMax', legendMax)

  // const intoThirds = Math.round(legendMax / 3)
  // const maxMinusThird = color(legendMax - intoThirds)
  // const maxMinusTwoThirds = color(legendMax - intoThirds * 2)
  // // console.log(maxMinusTwoThirds)
  // // console.log(maxMinusThird)
  // // console.log(maxColor)

  // const legendInterpolator = d3.piecewise(d3.interpolateHsl, ['#0400ff', maxMinusTwoThirds, maxMinusThird, maxColor])
  // // const legendColor = d3.scaleSequential(interpolator)
  // const legendColor = d3.scaleSequential(interpolator1)
  // // const legendColor = d3.scaleSequential(legendInterpolator)
  //   .domain([0, legendMax])
  //   .clamp(true)
  //   .nice()

  // legend({
  //   color: color1,
  //   title: "Cases / 100,000 People",
  //   // width: colorLegendWidth * 2 / 3,
  //   width: ua.device.type === "Mobile" ? mapWidth * 2 / 3 : colorLegendWidth * 2 / 3,
  //   marginLeft: 15,
  //   marginRight: 12,
  //   // xVal: colorLegendOffset,
  //   xVal: ua.device.type === "Mobile" ? 0 : colorLegendOffset,
  //   yVal: headerOffset,
  //   tickValues: [0, 100, 200, 300, colorCutoff]
  // })

  // legend({
  //   color: color2,
  //   // width: colorLegendWidth * 1 / 3,
  //   width: ua.device.type === "Mobile" ? mapWidth * 1 / 3 : colorLegendWidth * 1 / 3,
  //   marginLeft: 12,
  //   marginRight: 15,
  //   xVal: ua.device.type === "Mobile" ? mapWidth * 2 / 3 : colorLegendOffset + colorLegendWidth * 2 / 3,
  //   yVal: headerOffset,
  //   tickValues: [colorCutoff, 2000]
  // })

  // // ------------------------------------------------------
  // // // DATA: RANKING
  
  // const prevKF = new Map(d3.pairs(keyFrames, (a, b) => [b, a]))

  // // ------------------------------------------------------
  // // // DRAWING: SPIKES

  // const draw = frame => {
  //   ctx.clearRect(0, 0, mapWidth, mapHeight);
  //   frame.counties.forEach(d => {
  //     const xPos = countyPositions.get(d[0])[0];
  //     const yPos = countyPositions.get(d[0])[1];
  //     ctx.beginPath();
  //     ctx.moveTo(xPos - spikeWidth / 2, yPos);
  //     ctx.lineTo(xPos + spikeWidth / 2, yPos);
  //     ctx.lineTo(xPos, yPos - length(d[3]));
  //     ctx.closePath();

  //     try {
  //       ctx.fillStyle = color(d[2]).split(')')[0] + `, ${opacity})`
  //     } catch {
  //       console.log(d)
  //       ctx.fillStyle = 'blue';
  //     }

  //     ctx.fill();
  //   });
  // }

  // // const update = frame => {
  // //   try {
  // //     const prevCounties = prevKF.get(frame).counties;
  // //     const timer = d3.timer(elapsed => {
  // //       const t = Math.min(1, d3.easeLinear(elapsed / duration));
  // //       // const t = Math.min(1, dateProgress);
  // //       frame.counties.forEach((d, i) => {
  // //         const tweenCount = prevCounties[i][1] * (1 - t) + d[1] * t;
  // //         d.splice(3, 1, tweenCount);
  // //       });
  // //       draw(frame);
  // //       if (t === 1) timer.stop();
  // //     });
  // //   } catch {
  // //     frame.counties.forEach(d => d.splice(3, 1, d[1]));
  // //   }
  // // }

  // // ------------------------------------------------------
  // // // DRAWING: SPIKE LEGEND
  
  // const makeSpike = length => `M${-spikeWidth / 2},0L0,${-length}L${spikeWidth / 2},0`

  // const spikeLegend = mapSvg.append('g')
  //   .attr('class', 'spikeLegend hidden hideMe')
  //   .attr('text-anchor', 'middle')
  //   .attr('font-size', 8)
  //   .attr('fill', defaultTextColor)
  //   .attr("font-family", "helvetica")

  // const spikeLegendGs = spikeLegend.selectAll('g')
  //   // .data(length.ticks(4).slice(1).reverse())
  //   .data([20000, 10000, 5000])
  //  .join('g')
  //   .attr('transform', (d, i) => `translate(${mapWidth - (i + 1) * 15},${mapHeight - 20})`)
  //   // .attr('transform', (d, i) => ua.device.type === 'Mobile'
  //   //   ? `translate(${mapWidth + 7 - (i + 1) * 15},${mapHeight - 45})`
  //   //   : `translate(${mapWidth - (i + 1) * 15},${mapHeight - 45})`)

  // spikeLegendGs.append('path')
  //   .style('opacity', opacity)
  //   .attr('d', d => makeSpike(length(d)))

  // spikeLegendGs.append('text')
  //   .attr('dy', '1.1em')
  //   .text(length.tickFormat(4, "s"))

  // const spikeLegendDescriptionWidth = spikeLegend.node().getBoundingClientRect().width

  // spikeLegend.append('text')
  //   .attr('dy', '1.1em')
  //   .attr('text-anchor', 'end')
  //   .attr("font-weight", "bold")
  //   .attr('transform', `translate(${mapWidth - spikeLegendDescriptionWidth - 10},${mapHeight - 20})`)
  //   // ? macBounds.height - 150 - justMapHeight : macBounds.height - 10 - justMapHeight
  //   // .attr('transform', `translate(${mapWidth - spikeLegendDescriptionWidth - 10},${ua.device.type === "Mobile"
  //   //   ? properHeight - 10
  //   //   : properHeight - 10})`)
  //   .text('New Cases')

  // function scrub(keyframe) {
  //   updateTicker(keyframe);
  //   updateStateShapes(keyframe)
  //   updateProgress(keyframe)
  // }

  // const theEnd = performance.now()
  // console.log('rest: ', theEnd - postPromiseAll)

}

getData()