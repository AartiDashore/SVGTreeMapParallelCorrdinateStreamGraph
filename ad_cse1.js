const width = 1900, height = 800;

        async function loadAndProcessData(file) {
            const response = await fetch(file);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            // Aggregate data by department and section
            const aggregatedData = d3.group(data, d => d.Department, d => d.Section_Name);
            const hierarchyData = {
                name: "Departments",
                children: []
            };

            aggregatedData.forEach((sections, department) => {
                const deptChildren = [];
                let totalStudents = 0; // Track total students in department
                const uniqueProfessors = new Set(); // Track unique professors in department
                sections.forEach((courses, sectionName) => {
                    const sectionStudentCount = d3.sum(courses, d => d.Student_Count);
                    totalStudents += sectionStudentCount; // Add to department's total students
                    courses.forEach(course => uniqueProfessors.add(course.Faculty)); // Collect unique professors
                    deptChildren.push({
                        name: sectionName,
                        value: sectionStudentCount,
                        professors: [...new Set(courses.map(d => d.Faculty))].join(", "),
                        totalStudents: sectionStudentCount
                    });
                });
                hierarchyData.children.push({
                    name: department,
                    professors: uniqueProfessors.size, // Total unique professors
                    totalStudents: totalStudents, // Total students in department
                    children: deptChildren
                });
            });

            return hierarchyData;
        }

        async function renderTreemap() {
            const tooltip = d3.select(".tooltip");
            const data = await loadAndProcessData("CSE_Enrollment.xlsx");

            const root = d3.hierarchy(data)
                .sum(d => d.value)
                .sort((a, b) => b.value - a.value);

            const treemap = d3.treemap()
                .size([width, height])
                .paddingOuter(25)
                .paddingInner(5);

            treemap(root);

            const svg = d3.select("svg");

            const nodes = svg.selectAll("g")
                .data(root.descendants())
                .join("g")
                .attr("transform", d => `translate(${d.x0}, ${d.y0})`);

            nodes.append("rect")
                .attr("width", d => d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0)
                .attr("fill", d => d.depth === 1 ? "#76e5c5" : d.depth === 2 ? "#e3d0e6" : "#e3f2fd")
                .attr("stroke", "black")
                .on("mouseover", (event, d) => {
                    if (!d.data.name || d.depth === 0) return;
                    tooltip.style("opacity", 1)
                        .style("left", `${event.pageX + 5}px`)
                        .style("top", `${event.pageY + 5}px`)
                        .html(`
                            <strong>${d.data.name}</strong><br>
                            <em>Professors:</em> ${d.data.professors || "N/A"}<br>
                            <em>Total Students:</em> ${d.data.totalStudents || 0}
                        `);
                })
                .on("mouseout", () => tooltip.style("opacity", 0));

            nodes.append("text")
                .attr("x", 5)
                .attr("y", 15)
                .text(d => d.data.name)
                .attr("font-size", "10px")
                .attr("fill", "black")
                .style("pointer-events", "none")
                .style("font-weight", "bold")
                .style("display", d => {
                    // Hide labels for rectangles that are too narrow or short
                    const width = d.x1 - d.x0;
                    const height = d.y1 - d.y0;
                    return (width < 50 || height < 20) ? "none" : "block";
                });
        }

        renderTreemap();