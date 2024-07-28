const DATA_URL =
  "https://gist.githubusercontent.com/psuiuc/cf86c74b75aacad4b31600dcf79b33b1/raw/1c4b6cbc58bd3903a9c2597aff280d8992e5d46c/food.csv"
const MARGIN = {top: 20, right: 30, bottom: 40, left: 50}
const WIDTH = 800 - MARGIN.left - MARGIN.right
const HEIGHT = 500 - MARGIN.top - MARGIN.bottom

function sortByDate(a, b) {
  if (a.date < b.date) {
    return -1
  } else if (a.date > b.date) {
    return 1
  }
  return 0
}

function genCountsByAttrsAndDate(data, attrNames) {
  const parseDate = d3.timeParse("%m/%d/%Y")
  const formatMonth = d3.timeFormat("%Y-%m")
  const countsByDate = d3.rollup(
    data,
    (v) => v.length,
    (d) => formatMonth(parseDate(d.detection_date)),
    (d) => attrNames.map((attr) => d[attr]).join(",")
  )
  const ret = []
  countsByDate.forEach((value, key) => {
    const date = d3.timeParse("%Y-%m")(key)
    value.forEach((count, attrs) => {
      const v = {date, count}
      attrs.split(",").forEach((d, i) => {
        const attrName = attrNames[i]
        v[attrName] = d
      })
      ret.push(v)
    })
  })
  return ret.sort(sortByDate)
}

function genCountsByAttrs(data, attr1, attr2) {
  const counts = d3.rollup(
    data,
    (v) => v.length,
    (d) => d[attr1],
    (d) => d[attr2]
  )

  // keep track of max counts by attr1 for y-axis height
  let maxCountByAttr1 = -1
  const ret = []
  counts.forEach((value, key) => {
    let countByAttr1 = 0
    value.forEach((count, attr2Val) => {
      countByAttr1 += count
      ret.push({[attr1]: key, [attr2]: attr2Val, count})
      if (countByAttr1 > maxCountByAttr1) {
        maxCountByAttr1 = countByAttr1
      }
    })
  })
  return [ret, maxCountByAttr1]
}

function renderCounts(data, attr1, attr2, chartType) {
  switch (chartType) {
    case "bar":
      renderCountsAsBarChart(data, attr1, attr2)
  }
}

function renderCountsAsBarChart(data, attr1, attr2) {
  const [processedData, maxCountByAttr1] = genCountsByAttrs(data, attr1, attr2)
  const svg = d3
    .select("#d3-container")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)

  const attr1DistinctVals = Array.from(new Set(data.map((d) => d[attr1])))
  const attr2DistinctVals = Array.from(new Set(data.map((d) => d[attr2])))

  const x = d3
    .scaleBand()
    .domain(attr1DistinctVals)
    .range([0, WIDTH])
    .padding([0.2])
  svg
    .append("g")
    .attr("transform", `translate(0,${HEIGHT})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
  const y = d3
    .scaleLinear()
    .domain([0, maxCountByAttr1 * 1.1])
    .range([HEIGHT, 0])
  svg.append("g").call(d3.axisLeft(y))

  const color = d3
    .scaleOrdinal()
    .domain(attr2DistinctVals)
    .range(d3.schemeCategory10)

  const stack = d3
    .stack()
    .keys(attr2DistinctVals)
    .value((d, key) => d[key] || 0)
  const stackedData = stack(
    d3
      .rollups(
        processedData,
        (v) =>
          d3.rollup(
            v,
            (g) => g[0].count,
            (d) => d[attr2]
          ),
        (d) => d[attr1]
      )
      .map((d) => Object.fromEntries([[attr1, d[0]], ...d[1]]))
  )

  svg
    .append("g")
    .selectAll("g")
    .data(stackedData)
    .enter()
    .append("g")
    .attr("fill", (d) => color(d.key))
    .selectAll("rect")
    .data((d) => d)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.data[attr1]))
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth())
    .on("mouseover", function (event, d) {
      const attr2Val = d3.select(this.parentNode).datum().key
      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#f9f9f9")
        .style("padding", "5px")
        .style("border", "1px solid #d3d3d3")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("display", "block")

      tooltip
        .html(
          `${attr1}: ${d.data[attr1]}<br>${attr2}: ${attr2Val}<br>Count: ${
            d[1] - d[0]
          }`
        )
        .style("left", event.pageX + 5 + "px")
        .style("top", event.pageY - 28 + "px")
    })
    .on("mouseout", function () {
      d3.selectAll(".tooltip").remove()
    })

  const legend = svg.append("g").attr("transform", `translate(${WIDTH},0)`)
  legend
    .selectAll("rect")
    .data(attr2DistinctVals)
    .enter()
    .append("rect")
    .attr("x", -20)
    .attr("y", (d, i) => 20 + i * 20)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", (d) => color(d))
  legend
    .selectAll("text")
    .data(attr2DistinctVals)
    .enter()
    .append("text")
    .attr("x", -24)
    .attr("y", (d, i) => 20 + i * 20 + 8)
    .attr("text-anchor", "end")
    .text((d) => d)
}

function renderTimeseries(data, attrNames) {
  const processedData = genCountsByAttrsAndDate(data, attrNames)

  // Append the svg object to the body of the page
  const svg = d3
    .select("#d3-container")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)

  // Add X axis
  const x = d3
    .scaleTime()
    .domain(d3.extent(processedData, (d) => d.date))
    .range([0, WIDTH])
  svg
    .append("g")
    .attr("transform", `translate(0,${HEIGHT})`)
    .call(d3.axisBottom(x))
    .append("text")
    .attr("y", 35)
    .attr("x", WIDTH / 2)
    .attr("text-anchor", "middle")
    .text("Date")

  // Add Y axis
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(processedData, (d) => d.count)])
    .range([HEIGHT, 0])
  svg
    .append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -35)
    .attr("x", -HEIGHT / 2)
    .attr("text-anchor", "middle")
    .text("Count")

  const nestedData = d3.group(processedData, (d) =>
    attrNames.map((attr) => d[attr]).join(",")
  )

  // Define the line
  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.count))

  // Add the lines
  svg
    .selectAll(".line")
    .data(nestedData)
    .enter()
    .append("path")
    .attr("class", "line")
    .attr("d", (d) => line(d[1]))
    .style("fill", "none")
    .style("stroke", (d, i) => d3.schemeCategory10[i % 10])
    .style("stroke-width", 2)

  // Create tooltip div
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "#f9f9f9")
    .style("padding", "5px")
    .style("border", "1px solid #d3d3d3")
    .style("border-radius", "5px")
    .style("pointer-events", "none")
    .style("display", "none")

  // Add circles for tooltips
  svg
    .selectAll(".dot")
    .data(processedData)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.date))
    .attr("cy", (d) => y(d.count))
    .attr("r", 5)
    .style("fill", "#00000020")
    // .style("fill", (d, i) => d3.schemeCategory10[i % 10])
    .on("mouseover", function (event, d) {
      tooltip.transition().duration(200).style("display", "block")
      tooltip
        .html(
          attrNames
            .map((attrName) => `${attrName}: ${d[attrName]}`)
            .join("<br>") + `<br>Count: ${d.count}`
        )
        .style("left", event.pageX + 5 + "px")
        .style("top", event.pageY - 28 + "px")
    })
    .on("mouseout", function () {
      tooltip.transition().duration(500).style("display", "none")
    })
}

const state = {
  data: null,
  scene: "product_adulterant",
  vis: "bar",
}

d3.csv(DATA_URL).then((data) => {
  console.log(data[0])
  console.log(Object.keys(data[0]))
  state.data = data.sort(sortByDate)
  render()
})

// buttons
document.getElementById("product_adulterant").addEventListener("click", () => {
  state.scene = "product_adulterant"
  render()
})

document
  .getElementById("adulterant_health_risk")
  .addEventListener("click", () => {
    state.scene = "adulterant_health_risk"
    render()
  })

document
  .getElementById("severity_action_taken")
  .addEventListener("click", () => {
    state.scene = "severity_action_taken"
    render()
  })

document.getElementById("adulterant_severity").addEventListener("click", () => {
  state.scene = "adulterant_severity"
  render()
})

document.getElementById("bar").addEventListener("click", () => {
  state.vis = "bar"
  render()
})

document.getElementById("timeseries").addEventListener("click", () => {
  state.vis = "timeseries"
  render()
})

function render() {
  // Clear contents and re-render.
  d3.select("#d3-container").html("")
  switch (state.scene) {
    case "product_adulterant":
      document.getElementById("title").innerText =
        "Relationship between product and adulterant."
      document.getElementById("description").innerText =
        'Chicken and juice have a higher number of adulterants than other products. Butter is the least contaminated food. To see the health risk associated with each adulterant, click the "Adulterant vs Health Risk Relationship" button.'
      switch (state.vis) {
        case "timeseries":
          renderTimeseries(state.data, ["product_name", "adulterant"])
          break
        default:
          renderCounts(state.data, "product_name", "adulterant", "bar")
      }
      break
    case "adulterant_health_risk":
      document.getElementById("title").innerText =
        "Relationship between adulterant and health risk."
      document.getElementById("description").innerText =
        'Coloring agents and chalk have a slightly higher health risk than other adulterants. To see the severity count of each adulterant, click the "Adulterant vs Severity" button.'
      switch (state.vis) {
        case "timeseries":
          renderTimeseries(state.data, ["adulterant", "health_risk"])
          break
        default:
          renderCounts(state.data, "adulterant", "health_risk", "bar")
      }
      break
    case "adulterant_severity":
      document.getElementById("title").innerText =
        "Relationship between adulterant and severity."
      document.getElementById("description").innerText =
        'The distribution of adulterant vs serverity seems to be relatively balanced. However, sweeteners seem to have a higher proportion of "severe" severity. Finally, to see what actions were taken, click the "Severity vs Action Taken" button.'
      switch (state.vis) {
        case "timeseries":
          renderTimeseries(state.data, ["adulterant", "severity"])
          break
        default:
          renderCounts(state.data, "adulterant", "severity", "bar")
      }
      break
    case "severity_action_taken":
      document.getElementById("title").innerText =
        "Relationship between severity and action taken."
      document.getElementById("description").innerText =
        "Surprisingly, even a minor severity resulted in a similar number of product recalls as moderate and severe."
      switch (state.vis) {
        case "timeseries":
          renderTimeseries(state.data, ["severity", "action_taken"])
          break
        default:
          renderCounts(state.data, "severity", "action_taken", "bar")
      }
      break
    default:
      return
  }
}
