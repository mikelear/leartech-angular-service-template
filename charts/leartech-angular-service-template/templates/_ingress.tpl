{{/*
Ingress template.

TWO shapes are supported. The template picks the first one that has
values wired:

1. Explicit multi-host list — set `ingress.hosts:` in values.yaml:

     ingress:
       hosts:
         - host: www.example.com
           tlsSecret: tls-www-example-p
         - host: example.com
           tlsSecret: tls-example-p

   The chart renders ONE Ingress resource with per-host `rules[]` and
   per-host `tls[]` blocks so a single deployment fronts multiple
   canonical domains. Use for marketing-site + product-domain,
   www<->apex aliases, or transitional migrations.

   `seo.canonicalHost` is INDEPENDENT of this list — with multiple
   served hosts, one MUST be declared canonical or crawlers treat the
   copies as duplicate content.

2. Legacy jxRequirements single-host — the default when
   `ingress.hosts` is empty. Domain + namespaceSubDomain come from
   `jx-values.yaml` (auto-generated per cluster and per environment).
   Preview: jx preview create populates jx-values.yaml with the
   cluster's domain + namespaceSubDomain "-prN.". Staging: same
   pattern with "-jx-staging." Prod: "-jx-production."

Usage in chart templates/ingress.yaml:
  {{ include "leartech.ingress" . }}
*/}}

{{- define "leartech.ingress" -}}
{{- if .Values.knativeDeploy }}
{{/* knative bypasses raw Ingress — nothing to render here. */}}
{{- else if gt (len (.Values.ingress.hosts | default list)) 0 }}
{{ include "leartech.ingress.multiHost" . }}
{{- else if .Values.jxRequirements.ingress.domain }}
{{ include "leartech.ingress.singleHost" . }}
{{- end }}
{{- end -}}

{{/* ---------- Multi-host explicit-list Ingress ---------- */}}
{{- define "leartech.ingress.multiHost" -}}
{{- $hostName := .Values.service.name | default (include "leartech.fullname" .) }}
{{- $backendName := include "leartech.fullname" . }}
{{- $svcPort := .Values.service.externalPort | default 8080 }}
{{- $annotations := dict }}
{{- $_ := merge $annotations (.Values.ingress.annotations | default dict) }}
{{- if not (hasKey $annotations "kubernetes.io/ingress.class") }}
{{- $_ := set $annotations "kubernetes.io/ingress.class" (.Values.ingress.classAnnotation | default "nginx") }}
{{- end }}
apiVersion: {{ .Values.jxRequirements.ingress.apiVersion | default "networking.k8s.io/v1" }}
kind: Ingress
metadata:
  name: {{ $hostName }}
  labels:
    {{- include "leartech.labels" . | nindent 4 }}
    {{- with .Values.ingress.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- if $annotations }}
  annotations:
    {{- toYaml $annotations | nindent 4 }}
  {{- end }}
spec:
  rules:
  {{- range .Values.ingress.hosts }}
  - host: {{ .host }}
    http:
      paths:
      - path: /
        pathType: {{ $.Values.ingress.pathType | default "ImplementationSpecific" }}
        backend:
          service:
            name: {{ $backendName }}
            port:
              number: {{ $svcPort }}
  {{- end }}
  {{- $tlsHosts := list }}
  {{- range .Values.ingress.hosts }}
  {{- if .tlsSecret }}
  {{- $tlsHosts = append $tlsHosts . }}
  {{- end }}
  {{- end }}
  {{- if gt (len $tlsHosts) 0 }}
  tls:
  {{- range $tlsHosts }}
  - hosts:
    - {{ .host }}
    secretName: {{ .tlsSecret }}
  {{- end }}
  {{- end }}
{{- end -}}

{{/* ---------- Legacy single-host jxRequirements Ingress ---------- */}}
{{- define "leartech.ingress.singleHost" -}}
{{- $hostName := .Values.service.name | default (include "leartech.fullname" .) }}
{{- $backendName := include "leartech.fullname" . }}
{{- $svcPort := .Values.service.externalPort | default 8080 }}
{{- $annotations := dict }}
{{- $_ := merge $annotations (.Values.ingress.annotations | default dict) (.Values.jxRequirements.ingress.annotations | default dict) }}
{{- if not (hasKey $annotations "kubernetes.io/ingress.class") }}
{{- $_ := set $annotations "kubernetes.io/ingress.class" (.Values.ingress.classAnnotation | default "nginx") }}
{{- end }}
apiVersion: {{ .Values.jxRequirements.ingress.apiVersion | default "networking.k8s.io/v1" }}
kind: Ingress
metadata:
  name: {{ $hostName }}
  labels:
    {{- include "leartech.labels" . | nindent 4 }}
    {{- with .Values.ingress.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- if $annotations }}
  annotations:
    {{- toYaml $annotations | nindent 4 }}
  {{- end }}
spec:
  rules:
  - host: {{ $hostName }}{{ .Values.jxRequirements.ingress.namespaceSubDomain }}{{ .Values.jxRequirements.ingress.domain }}
    http:
      paths:
      - path: /
        pathType: {{ .Values.ingress.pathType | default "ImplementationSpecific" }}
        backend:
          service:
            name: {{ $backendName }}
            port:
              number: {{ $svcPort }}
{{- if .Values.jxRequirements.ingress.tls.enabled }}
  tls:
  - hosts:
    - {{ $hostName }}{{ .Values.jxRequirements.ingress.namespaceSubDomain }}{{ .Values.jxRequirements.ingress.domain }}
{{- if .Values.jxRequirements.ingress.tls.production }}
    secretName: "tls-{{ .Values.jxRequirements.ingress.domain | replace "." "-" }}-p"
{{- else }}
    secretName: "tls-{{ .Values.jxRequirements.ingress.domain | replace "." "-" }}-s"
{{- end }}
{{- end }}
{{- end -}}
